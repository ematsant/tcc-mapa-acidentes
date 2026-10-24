# Mineração de Dados Espaciais para Segurança Viária

> **Trabalho de Conclusão de Curso (TCC)**  
> **Estudo de Caso:** Município de Franca – SP (2022–2026)  
> **Abordagem:** Aprendizado de Máquina Não Supervisionado por Densidade (DBSCAN) vs. Agrupamento Particional (K-Means) e Divisão Administrativa por Bairros.

---

## 📌 Visão Geral do Projeto

A contagem tradicional de acidentes por bairros distribui os dados por áreas muito grandes, dificultando a localização dos cruzamentos onde as colisões realmente acontecem.

Este trabalho propõe uma metodologia para identificar **áreas de risco em escala local**, utilizando o algoritmo espacial **DBSCAN** (*Density-Based Spatial Clustering of Applications with Noise*), ponderado pela gravidade das ocorrências e pelas estimativas de custos sociais do **IPEA (2020)**.

O projeto é composto por:
1. **Pipeline de Dados (Python)**: Limpeza, conversão para o sistema métrico SIRGAS 2000 UTM 23S e agrupamento espacial por densidade.
2. **Aplicação Web Interativa (HTML5, CSS, JavaScript, Leaflet)**: Visualização em mapa interativo com clusters, mapa de calor, polígonos de risco, filtros temporais e cálculo de custo social acumulado.
3. **Módulo de Auditoria Espacial**: Script para conferência independente das métricas em terminal comparando o DBSCAN com o K-Means.

---

## 🛡️ Auditoria Espacial e Limpeza de Dados (Data Cleaning)

As bases de dados abertos do **Infosiga SP** consolidam informações textuais de Boletins de Ocorrência da Polícia Civil e Militar. Em análises espaciais aplicadas à segurança pública, há um desafio metodológico crítico conhecido como **imprecisão de centróide por contingência** (*fallback geocoding* e *point stacking*):

1. **Origem do Problema:** Quando o registro policial não contém o número predial exato da via, refere-se a trechos de rodovias sem quilometragem precisa ou decorre de estradas rurais, os motores automatizados de geocodificação não conseguem posicionar o evento no ponto exato da pista. Por regra de contingência, o sistema atribui o acidente às coordenadas centrais (centróide) do CEP ou bairro.
2. **O Risco de Falsos Positivos:** Esse mecanismo provoca o "empilhamento artificial" de ocorrências em uma única coordenada geográfica. Em Franca, identificou-se um ponto na zona sul (Jardim Aeroporto IV) reunindo 128 acidentes; entretanto, a auditoria dos dados revelou **108 logradouros distintos** (incluindo rodovias e avenidas em outros extremos da cidade). Sem uma limpeza rigorosa, algoritmos por densidade como o DBSCAN interpretariam esse ponto artificial como uma zona de risco com altíssimo custo social.
3. **Regra de Detecção Algorítmica:** O pipeline (`processador.py`) implementou uma verificação de consistência entre ruas e coordenadas:
   * **Em cruzamentos reais:** Mesmo com dezenas de acidentes, os boletins registram apenas as 2 ou 3 vias que formam aquela esquina.
   * **Em centróides com erro:** O sistema acumula dezenas de acidentes no mesmo ponto, mas com nomes de ruas completamente divergentes.
   * **Critério de eliminação:** Coordenadas com 8 ou mais acidentes onde metade ou mais (50%+) dos registros trazem nomes de ruas diferentes são identificadas como erros de localização e descartadas.
4. **Resultado da Limpeza:** Foram removidas 11 coordenadas inconsistentes que concentravam 691 registros com localização imprecisa, preservando **9.259 sinistros espaciais fidedignos** para a modelagem do DBSCAN.

---

## 🔬 Resultados e Comparativo de Métodos de Agrupamento Espacial

A avaliação comparativa foi processada no sistema de coordenadas métricas oficial brasileiro (**SIRGAS 2000 / UTM zone 23S - EPSG:31983**), comparando o modelo proposto com o modelo geométrico particional (**K-Means**):

| Critério Avaliado | Modelo DBSCAN | Modelo K-Means (Controle) | Divisão por Bairros |
| :--- | :---: | :---: | :---: |
| **Sinistros com Vítimas Concentrados** | **31,56% (1.817 de 5.757)** | 31,56% *(pareado)* | ~40% a 50% |
| **Área Ocupada em Franca** | **0,95 km²** | 62,79 km² | ~60 a 70 km² |
| **Ocupação Territorial Municipal** | **0,16% de Franca** | 10,37% de Franca | ~45% da malha urbana |
| **Razão de Área** | **1x (Referência)** | **65,94x maior que o DBSCAN** | > 70x maior |
| **Tratamento de Pontos Isolados** | Classificados como ruído | Forçados ao cluster mais próximo | Somados ao total do bairro |
| **Escala de Delimitação** | **Cruzamentos e trechos viários** | Regional (área ampla) | Setorial (bairro inteiro) |

> **Síntese dos Resultados**: As 107 áreas de risco delimitadas pelo **DBSCAN** concentram **31,56% dos acidentes com vítimas e óbitos** (1.817 de 5.757 ocorrências) em **0,95 km² de área territorial** (0,16% do município). Em comparação, o modelo de controle **K-Means** demandou **62,79 km² (uma área 65,94 vezes maior)** para abranger a mesma proporção de sinistros graves. Sob a perspectiva de aplicação prática, esses resultados indicam que o poder público pode atuar em 0,95 km² da malha viária para abranger quase um terço de todas as ocorrências com feridos e óbitos em Franca.

---

## 🛠️ Como Testar e Reproduzir os Resultados no Terminal

Para conferência dos cálculos, as rotinas matemáticas podem ser executadas diretamente via terminal (no VS Code, pressione **`Ctrl + '`** ou acesse o menu **Terminal > Novo Terminal**):

### 1. Clonar o repositório
```bash
git clone https://github.com/ematsant/tcc-mapa-acidentes.git
cd tcc-mapa-acidentes
```

### 2. Configurar o ambiente Python
```bash
# Criação do ambiente virtual
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate

# Instalação das dependências
pip install -r requirements.txt
```

### 3. Executar o pipeline e os testes de dados
```bash
# Etapa 1: Executar o ETL com Auditoria Espacial
python processador.py

# Etapa 2: Gerar os Polígonos de Risco (DBSCAN)
python analise_espacial.py

# Etapa 3: Executar a Auditoria Métrica Comparativa (SIRGAS 2000 UTM 23S)
python calcula_metricas_area.py
```

### Saída gerada no terminal:
```text
Processando dados espaciais de Franca - SP...
================================================================================
AVALIAÇÃO ESPACIAL DE ACIDENTES — MUNICÍPIO DE FRANCA/SP
Período: Jan/2022 a Ago/2026 (4 anos e 8 meses) | Sistema: SIRGAS 2000 (UTM 23S)
================================================================================

1. BASE DE DADOS AUDITADA:
   • Total de acidentes válidos: 9.259 ocorrências (após limpeza de centróides)
   • Acidentes com vítimas (feridos e óbitos): 5.757 ocorrências (62.2% da base)
   • Escopo da modelagem: Identificar as áreas de maior concentração desses
     eventos com vítimas no município.

--------------------------------------------------------------------------------
2. RESULTADOS DO MODELO PROPOSTO (DBSCAN — Agrupamento por Densidade):
--------------------------------------------------------------------------------
   • Zonas de risco delimitadas: 107 áreas (cruzamentos e trechos viários)
   • Área total delimitada: 0.95 km² (0.16% do território de Franca)
   • Cobertura de eventos graves: 1.817 ocorrências com vítimas (feridos e óbitos)
   • Proporção observada: As áreas concentram 31.56% dos acidentes com vítimas
     do município (1.817 de 5.757 com feridos e óbitos) em 0.95 km².

--------------------------------------------------------------------------------
3. COMPARAÇÃO COM O K-MEANS (Grupo de Controle Comparativo):
--------------------------------------------------------------------------------
   • Quantidade de grupos pareada: K = 107 regiões equivalentes
   • Área delimitada pelo K-Means: 62.79 km² (10.37% do território municipal)
   • Razão de área: A área delimitada pelo K-Means foi 65.94 vezes maior
     que a área delimitada pelo DBSCAN para cobrir a mesma proporção de sinistros.
   • Diferença metodológica: O K-Means divide o espaço em polígonos convexos
     amplos que abrangem vazios urbanos; o DBSCAN contorna os pontos densos
     ao longo das vias e classifica as ocorrências isoladas como ruído.

--------------------------------------------------------------------------------
4. SÍNTESE COMPARATIVA E APLICAÇÃO:
--------------------------------------------------------------------------------
   • O modelo baseado em densidade (DBSCAN) delimitou 0.95 km² para concentrar
     31.56% dos acidentes com vítimas (feridos e óbitos), enquanto o modelo
     particional (K-Means) demandou 62.79 km² para cobrir o mesmo volume.
   • Sob a perspectiva de aplicação prática, esses resultados indicam que o
     poder público pode atuar em 0.95 km² da malha viária para abranger
     quase um terço de todas as ocorrências com feridos e óbitos em Franca.
================================================================================
```

---

## 💻 Executando e Visualizando a Aplicação Web Localmente (com foco no VS Code)

A aplicação web é uma **Single Page Application (SPA)** estática que não depende de servidores de backend ou banco de dados relacional. Como os mapas consomem arquivos `.json` e `.geojson`, os navegadores exigem que a página seja servida por um protocolo HTTP local (evitando restrições de CORS que ocorrem ao abrir arquivos diretamente como `file://`).

### Opção A: Via Terminal Integrado do VS Code (Recomendado)
1. No VS Code, abra o terminal integrado com o atalho: **`Ctrl + '`** (ou menu **Terminal > Novo Terminal**).
2. Inicie o servidor estático nativo do Python:
   ```bash
   python3 -m http.server 8000
   ```
3. Abra o navegador e acesse as páginas:
   * **Mapa Interativo Principal:** [http://localhost:8000/index.html](http://localhost:8000/index.html)  
     *(Contém filtros dinâmicos de ano, gravidade, turno, exportação CSV e visualização das 107 zonas de risco).*
   * **Página de Metodologia e Resultados:** [http://localhost:8000/metodologia.html](http://localhost:8000/metodologia.html)  
     *(Detalhamento da auditoria de centróides, KPIs comparativos com o K-Means e card de terminal).*

### Opção B: Via Extensão Live Server do VS Code
Se você utiliza a extensão **Live Server** (Ritwick Dey):
1. Clique com o botão direito sobre `index.html` ou `metodologia.html` na barra lateral esquerda de arquivos do VS Code.
2. Selecione a opção **"Open with Live Server"**. O navegador padrão abrirá a aplicação automaticamente.

### 💡 Visualização Formatada do README no VS Code
Para visualizar este documento renderizado com formatação visual e tabelas:
* Abra o arquivo `README.md` no VS Code e pressione **`Ctrl + Shift + V`** (ou clique no ícone de *Preview* no canto superior direito do editor).

---

## 📂 Estrutura de Arquivos

```text
├── index.html                 # Interface web principal do mapa interativo
├── metodologia.html           # Página dedicada de Metodologia & Benchmark Científico
├── style.css                  # Folha de estilos completa (Glassmorphism e temas claro/escuro)
├── script.js                  # Lógica interativa da aplicação (Leaflet, filtros e gráficos)
│
├── dados_acidentes.json       # Base consolidada de 9.259 sinistros auditados em Franca/SP (2022-2026)
├── hotspots.geojson           # Geometrias dos 107 polígonos de risco delimitados (DBSCAN)
├── etl_metrics.json           # Métricas computacionais e log de auditoria de dados espaciais
│
├── calcula_metricas_area.py   # Script de auditoria métrica e validação científica do benchmark
├── analise_espacial.py        # Algoritmo DBSCAN que gera os polígonos de risco
├── processador.py             # Script de extração, auditoria espacial e tratamento dos dados do Infosiga
│
├── requirements.txt           # Dependências Python (pandas, geopandas, shapely, scikit-learn)
├── .gitignore                 # Regras de exclusão do Git (ignora dados brutos > 100MB e venv)
└── README.md                  # Este documento
```

---

## 📚 Referências Bibliográficas

* **ESTER, Martin et al.** *A density-based algorithm for discovering clusters in large spatial databases with noise.* In: Proceedings of the Second International Conference on Knowledge Discovery and Data Mining (KDD-96). AAAI Press, 1996. p. 226-231.
* **IPEA – INSTITUTO DE PESQUISA ECONÔMICA APLICADA.** *Custos dos acidentes de trânsito no Brasil: estimativas atualizadas.* Brasília: Ipea, 2020.
* **SÃO PAULO (Estado).** *Sistema de Informações Gerenciais de Acidentes de Trânsito do Estado de São Paulo - Infosiga SP.* Secretaria de Logística e Transportes do Estado de São Paulo, 2026.
* **TRANSPORTATION RESEARCH BOARD.** *Highway Safety Manual (HSM).* Washington, D.C.: AASHTO, 2010.
* **VITAL STRATEGIES.** *Guia de Geocodificação e Gestão de Dados de Segurança Viária.* Parceria por Cidades Saudáveis, 2021.
* **WAZLAWICK, Raul Sidnei.** *Metodologia de Pesquisa para Ciência da Computação.* 2. ed. Rio de Janeiro: Elsevier, 2014.
