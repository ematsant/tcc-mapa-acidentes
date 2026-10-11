import json
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
import geopandas as gpd
from shapely.geometry import Point, MultiPoint

print("1. Carregando dados de acidentes...")
with open('dados_acidentes.json', 'r', encoding='utf-8') as f:
    dados = json.load(f)

df = pd.DataFrame(dados)
df = df.dropna(subset=['latitude', 'longitude', 'ano'])

# Filtrar coordenadas para garantir que estão na região de Franca (remover outliers brutos)
df = df[(df['latitude'] >= -21.0) & (df['latitude'] <= -20.0) & 
        (df['longitude'] >= -48.0) & (df['longitude'] <= -46.0)]

print(f"2. Preparando dados e partições temporais ({len(df)} registros válidos)...")

# Pesos baseados na gravidade para o algoritmo
def calcular_peso(gravidade):
    if gravidade == 'fatal': return 5
    elif gravidade == 'com_vitima': return 2
    else: return 1

df['peso'] = df['gravidade'].apply(calcular_peso)

# O período oficial do projeto para pontos críticos é de 5 anos (2022-2026) 
# conforme recomendação internacional (HSM) para evitar regressão à média.
cenarios = ['2022-2026']
poligonos = []

for cenario in cenarios:
    print(f"\n--- Processando DBSCAN para o cenário: {cenario} ---")
    df_cenario = df.copy()
        
    if len(df_cenario) == 0:
        continue
        
    coords = np.radians(df_cenario[['latitude', 'longitude']].values)
    pesos = df_cenario['peso'].values
    
    # Raio de busca: 50 metros
    raio_metros = 50
    epsilon = raio_metros / 6371000.0
    
    # Exige 20 pontos para considerar cluster (período de 5 anos)
    min_pts_cenario = 20
    
    db = DBSCAN(eps=epsilon, min_samples=min_pts_cenario, metric='haversine', algorithm='ball_tree')
    df_cenario['cluster'] = db.fit_predict(coords, sample_weight=pesos)
    
    clusters_validos = df_cenario[df_cenario['cluster'] != -1]
    print(f"Encontrados {clusters_validos['cluster'].nunique()} hotspots no cenário {cenario}.")
    
    for cluster_id, grupo in clusters_validos.groupby('cluster'):
        if len(grupo) >= 3:
            pontos = [Point(xy) for xy in zip(grupo['longitude'], grupo['latitude'])]
            multiponto = MultiPoint(pontos)
            
            try:
                poligono = multiponto.concave_hull(ratio=0.1).buffer(0.0002)
            except Exception:
                poligono = multiponto.convex_hull.buffer(0.0002)
                
            # Estatísticas agregadas de severidade, modais e temporalidade por cluster
            qtd_acidentes = len(grupo)
            fatais = len(grupo[grupo['gravidade'] == 'fatal'])
            com_vitima = len(grupo[grupo['gravidade'] == 'com_vitima'])
            sem_vitima = len(grupo[grupo['gravidade'] == 'sem_vitima'])
            
            # Análise de veículos
            veiculos = grupo['tipo_veiculo'].astype(str).str.upper()
            qtd_motos = veiculos.str.contains('MOTO').sum()
            qtd_carros = veiculos.str.contains('AUTOMOVEL').sum()
            
            pct_motos = round((qtd_motos / qtd_acidentes) * 100, 1) if qtd_acidentes > 0 else 0
            pct_carros = round((qtd_carros / qtd_acidentes) * 100, 1) if qtd_acidentes > 0 else 0
            
            # Turno e dia de maior incidência
            turno_comum = grupo['turno'].mode().iloc[0] if not grupo['turno'].empty else 'N/A'
            dia_comum = grupo['dia_semana'].mode().iloc[0] if not grupo['dia_semana'].empty else 'N/A'
                
            poligonos.append({
                'cluster_id': int(cluster_id),
                'periodo': str(cenario),
                'qtd_acidentes': qtd_acidentes,
                'fatais': fatais,
                'com_vitima': com_vitima,
                'sem_vitima': sem_vitima,
                'pct_motos': pct_motos,
                'pct_carros': pct_carros,
                'turno_critico': turno_comum,
                'dia_critico': dia_comum,
                'geometry': poligono
            })

if poligonos:
    gdf = gpd.GeoDataFrame(poligonos, geometry='geometry', crs="EPSG:4326")
    print("\nExportando hotspots.geojson com dimensões espaciais, temporais e perfil de veículos...")
    gdf.to_file('hotspots.geojson', driver='GeoJSON')
    print("✅ Concluído! Arquivo hotspots.geojson gerado com sucesso.")
else:
    print("⚠️ Nenhum cluster formou polígono.")
