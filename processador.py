import pandas as pd
import json
import time
import psutil
import os

start_time_total = time.time()
process = psutil.Process(os.getpid())
def get_memory_mb():
    return round(process.memory_info().rss / (1024 * 1024), 2)

metrics = {
    'steps': {}
}
metrics['memory_initial_mb'] = get_memory_mb()

# 1. Arquivo base – usando apenas período confiável 2022‑2026
arq_sinistros_new1 = 'data/raw/sinistros_2022-2024.csv'
arq_sinistros_new2 = 'data/raw/sinistros_2025-2026.csv'
arq_veiculos_new1 = 'data/raw/veiculos_2022-2024.csv'
arq_veiculos_new2 = 'data/raw/veiculos_2025-2026.csv'
arq_pessoas_new1 = 'data/raw/pessoas_2022-2024.csv'
arq_pessoas_new2 = 'data/raw/pessoas_2025-2026.csv'

# 2. Chave de ligação
NOME_COLUNA_ID = 'id_sinistro'

def ler_csv(caminho):
    """Tenta ler o CSV usando ';' como delimitador; se falhar usa ','"""
    try:
        return pd.read_csv(caminho, encoding='latin1', sep=';', low_memory=False, on_bad_lines='skip')
    except Exception:
        return pd.read_csv(caminho, encoding='latin1', sep=',', low_memory=False, on_bad_lines='skip')

try:
    print("1. Lendo todos os arquivos CSV (isto pode demorar um pouco)...")
    t0 = time.time()
    df_sin = pd.concat([ler_csv(arq_sinistros_new1), ler_csv(arq_sinistros_new2)], ignore_index=True)
    df_veic = pd.concat([ler_csv(arq_veiculos_new1), ler_csv(arq_veiculos_new2)], ignore_index=True)
    df_pes = pd.concat([ler_csv(arq_pessoas_new1), ler_csv(arq_pessoas_new2)], ignore_index=True)
    metrics['steps']['1_leitura'] = {'time_s': round(time.time() - t0, 2), 'memory_mb': get_memory_mb()}

    print("2. Filtrando apenas a cidade de Franca...")
    t0 = time.time()
    col_municipio = 'municipio' if 'municipio' in df_sin.columns else 'MUNICIPIO'
    df_sin = df_sin[df_sin[col_municipio].str.upper() == 'FRANCA']
    df_sin = df_sin.dropna(subset=['latitude', 'longitude'])
    metrics['steps']['2_filtragem'] = {'time_s': round(time.time() - t0, 2), 'memory_mb': get_memory_mb()}

    print("3. Agrupando veículos por acidente...")
    t0 = time.time()
    col_veic = 'tipo_veiculo' if 'tipo_veiculo' in df_veic.columns else df_veic.columns[-1]
    df_veic_agg = df_veic.groupby(NOME_COLUNA_ID)[col_veic].apply(
        lambda x: ', '.join(x.dropna().astype(str).unique())
    ).reset_index()
    metrics['steps']['3_agrupamento_veiculos'] = {'time_s': round(time.time() - t0, 2), 'memory_mb': get_memory_mb()}

    print("4. Classificando gravidade das vítimas...")
    t0 = time.time()
    df_pes['todas_infos'] = df_pes.apply(lambda row: ' '.join(row.dropna().astype(str).str.upper()), axis=1)

    def classifica_gravidade(textos):
        texto_completo = ' '.join(textos)
        if any(p in texto_completo for p in ['FATAL', 'ÓBITO', 'OBITO', 'MORTO']):
            return 'fatal'
        if any(p in texto_completo for p in ['GRAVE', 'LEVE', 'COM VÍTIMA', 'FERIDO']):
            return 'com_vitima'
        return 'sem_vitima'

    df_pes_agg = df_pes.groupby(NOME_COLUNA_ID)['todas_infos'].apply(classifica_gravidade).reset_index()
    df_pes_agg.rename(columns={'todas_infos': 'gravidade_calculada'}, inplace=True)
    metrics['steps']['4_classificacao_vitimas'] = {'time_s': round(time.time() - t0, 2), 'memory_mb': get_memory_mb()}

    print("5. Mesclando todas as tabelas...")
    t0 = time.time()
    df_completo = pd.merge(df_sin, df_veic_agg, on=NOME_COLUNA_ID, how='left')
    df_completo = pd.merge(df_completo, df_pes_agg, on=NOME_COLUNA_ID, how='left')
    metrics['steps']['5_merge'] = {'time_s': round(time.time() - t0, 2), 'memory_mb': get_memory_mb()}

    print("6. Gerando JSON final para o mapa...")
    t0 = time.time()
    col_sinistro = 'tp_sinistro_primario'
    if col_sinistro not in df_sin.columns:
        for c in ['tipo_sinistro', 'TIPO_SINISTRO', 'tp_sinistro_secundario']:
            if c in df_sin.columns:
                col_sinistro = c
                break

    dados_json = []
    for _, row in df_completo.iterrows():
        try:
            lat = float(str(row['latitude']).replace(',', '.'))
            lon = float(str(row['longitude']).replace(',', '.'))
            if not (-21.0 <= lat <= -20.0 and -48.0 <= lon <= -46.0):
                continue
            # Ano
            ano = "Desconhecido"
            if 'ano_sinistro' in row and pd.notna(row['ano_sinistro']):
                ano = str(row['ano_sinistro']).strip()
            elif 'ano_mes_sinistro' in row and pd.notna(row['ano_mes_sinistro']):
                ano = str(row['ano_mes_sinistro'])[:4]
            # Veículos
            veiculos = str(row.get(col_veic, 'NÃO INFORMADO')).strip()
            if veiculos in ('nan', ''):
                veiculos = 'NÃO INFORMADO'
            def limpa(valor):
                v = str(valor).strip()
                return 'NÃO INFORMADO' if v in ('nan', '', 'None') else v

            gravidade = limpa(row.get('gravidade_calculada', 'sem_vitima'))
            
            # Custo Social (Baseado no IPEA 2020)
            if gravidade == 'fatal':
                custo = 664821
            elif gravidade == 'com_vitima':
                custo = 261689
            else:
                custo = 25000
                
            dados_json.append({
                "latitude": lat,
                "longitude": lon,
                "ano": ano,
                "gravidade": gravidade,
                "custo_social": custo,
                "data": limpa(row.get('data_sinistro', row.get('DATA_SINISTRO', 'NÃO INFORMADO'))),
                "turno": limpa(row.get('turno', row.get('TURNO', 'NÃO INFORMADO'))),
                "dia_semana": limpa(row.get('dia_da_semana', row.get('DIA_DA_SEMANA', 'NÃO INFORMADO'))),
                "tipo_sinistro": limpa(row.get(col_sinistro, 'NÃO INFORMADO')),
                "tipo_veiculo": veiculos
            })
        except Exception:
            continue

    with open('dados_acidentes.json', 'w', encoding='utf-8') as f:
        json.dump(dados_json, f, ensure_ascii=False, indent=4)

    metrics['steps']['6_geracao_json'] = {'time_s': round(time.time() - t0, 2), 'memory_mb': get_memory_mb()}
    metrics['total_time_s'] = round(time.time() - start_time_total, 2)
    metrics['total_records'] = len(dados_json)
    metrics['final_memory_mb'] = get_memory_mb()

    # Calcular tamanho dos arquivos (taxa de compressao)
    try:
        tamanho_original = sum(os.path.getsize(f) for f in [arq_sinistros_new1, arq_sinistros_new2, arq_veiculos_new1, arq_veiculos_new2, arq_pessoas_new1, arq_pessoas_new2] if os.path.exists(f))
        tamanho_final = os.path.getsize('dados_acidentes.json')
        if tamanho_original > 0:
            metrics['compression'] = {
                'original_size_mb': round(tamanho_original / (1024*1024), 2),
                'final_size_mb': round(tamanho_final / (1024*1024), 2),
                'reduction_percentage': round(100 - (tamanho_final / tamanho_original * 100), 2)
            }
    except Exception as e:
        metrics['compression_error'] = str(e)

    with open('etl_metrics.json', 'w', encoding='utf-8') as f:
        json.dump(metrics, f, ensure_ascii=False, indent=4)

    print(f"✅ JSON gerado com {len(dados_json)} registros de acidentes (2022‑2026).")
    print("✅ Métricas do ETL salvas em 'etl_metrics.json'.")

except Exception as e:
    print(f"❌ Erro ao processar os dados: {e}")