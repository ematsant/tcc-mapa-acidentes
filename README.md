# Plataforma de Mapeamento e Detecção de Zonas de Risco de Sinistros de Trânsito

> **Trabalho de Conclusão de Curso (TCC)**  
> **Estudo de Caso:** Município de Franca – SP (2022–2026)  
> **Abordagem:** Aprendizado de Máquina Não Supervisionado por Densidade (DBSCAN) vs. Agrupamento Particional (K-Means) e Divisão Administrativa por Bairros.

---

## 📌 Visão Geral do Projeto

A agregação de sinistros de trânsito por divisões político-administrativas (como bairros ou setores censitários) distribui ocorrências pontuais sobre polígonos territoriais extensos, de modo que a concentração espacial em cruzamentos específicos fica dispersa na área agregada do bairro.

Este projeto propõe uma metodologia quantitativa para identificação de **microzonas de concentração de sinistros**, aplicando o algoritmo de agrupamento espacial **DBSCAN** (*Density-Based Spatial Clustering of Applications with Noise*), ponderado pela gravidade das ocorrências e pelas estimativas de custos sociais do **IPEA (2020)**.

A solução é composta por:
1. **Pipeline de Engenharia e Análise de Dados (Python)**: Extração, filtragem, reprojeção geodésica no sistema SIRGAS 2000 UTM 23S e agrupamento espacial por densidade.
2. **Plataforma Web Interativa (HTML5, Vanilla CSS, JavaScript, Leaflet)**: Visualização cartográfica com clusterização, mapas de calor, polígonos delimitados, filtros temporais e cálculo do custo social acumulado.
3. **Módulo de Avaliação Espacial**: Script reprodutível de medição métrica que compara os resultados do modelo proposto com o modelo de controle particional.

---

## 🔬 Resultados e Comparativo de Métodos de Agrupamento Espacial

A avaliação comparativa foi processada no sistema de coordenadas métricas oficial brasileiro (**SIRGAS 2000 / UTM zone 23S - EPSG:31983**), comparando o modelo proposto com o modelo geométrico particional (**K-Means**):

| Critério Avaliado | Agrupamento por Densidade (DBSCAN) | Agrupamento Particional (K-Means) | Divisão Administrativa por Bairros |
| :--- | :---: | :---: | :---: |
| **Acidentes Graves Abrangidos** | **35,04%** | 35,04% *(pareado)* | ~40% a 50% |
| **Área Total Delimitada** | **0,98 km²** | 59,68 km² | ~60 a 70 km² |
| **Porcentagem do Município** | **0,16% de Franca** | 9,86% de Franca | ~45% da malha urbana |
| **Razão de Área** | **1x (Referência)** | **60,96x maior** | > 65x maior |
| **Ocorrências Isoladas** | Classificadas como ruído espacial | Atribuídas a um cluster euclidiano | Agregadas ao total do bairro |
| **Escala de Aplicação** | **Local (cruzamento ou trecho)** | Regional / Intermediária | Setorial (bairro inteiro) |

> **Síntese dos Resultados**: As 111 áreas de risco identificadas concentram **35,04% dos acidentes com vítimas e óbitos** de Franca em **0,16% do território do município (0,98 km² de 605,60 km²)**, enquanto o modelo particional K-Means delimitou **59,68 km² (9,86% do território)** para cobrir a mesma proporção de ocorrências.

---

## 🛠️ Como Testar e Reproduzir os Resultados no Terminal

Para conferência dos cálculos, as rotinas matemáticas podem ser executadas diretamente via terminal:

### 1. Clonar o repositório
```bash
git clone https://github.com/ematsant/PrevencaoAcidentesFranca.git
cd PrevencaoAcidentesFranca
```

### 2. Configurar o ambiente Python
```bash
# Criação do ambiente virtual
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate

# Instalação das dependências
pip install -r requirements.txt
```

### 3. Executar o teste dos dados
```bash
python calcula_metricas_area.py
```

### Saída gerada no terminal:
```text
Processando dados espaciais de Franca - SP...
======================================================================
RELATÓRIO DE AVALIAÇÃO ESPACIAL E RESULTADOS (TCC)
Município: Franca - SP | Projeção: SIRGAS 2000 / UTM 23S (EPSG:31983)
======================================================================

1. MÉTODO PROPOSTO (DBSCAN - Agrupamento por Densidade):
   • Cobertura de Acidentes Graves: 35.04% (com vítimas e óbitos)
   • Área Total das Zonas de Risco: 0.98 km²
   • Ocupação do Município: 0.16% de Franca (total de 605.6 km²)

2. MÉTODO DE CONTROLE (K-MEANS):
   • Quantidade de Grupos Pareada: 111
   • Área Ocupada: 59.68 km²
   • Ocupação do Município: 9.86% de Franca

3. COMPARAÇÃO DOS RESULTADOS:
   • Razão de Área: A área delimitada pelo K-Means é 60.96 vezes maior que a do DBSCAN.
   • Síntese: As 111 áreas de risco concentram 35.04% dos acidentes com vítimas e óbitos
     em 0.16% do território do município de Franca (0.98 km² de 605.6 km²).
======================================================================
```

---

## 💻 Executando a Aplicação Web Localmente

A aplicação web é uma **Single Page Application (SPA)** estática que não depende de servidores de backend ou banco de dados relacional. Para executá-la em seu computador:

```bash
# Iniciar um servidor estático simples com Python
python3 -m http.server 8000
```

Abra o navegador no endereço: **`http://localhost:8000`**

* **`index.html`**: Mapa interativo com filtros de ano, gravidade, turno, veículos, exportação em CSV e alternador de tema claro/escuro.
* **`metodologia.html`**: Página exclusiva detalhando a metodologia, indicadores científicos e auditoria.

---

## 📂 Estrutura de Arquivos

```text
├── index.html                 # Interface web principal do mapa interativo
├── metodologia.html           # Página dedicada de Metodologia & Benchmark Científico
├── style.css                  # Folha de estilos completa (Glassmorphism e temas claro/escuro)
├── script.js                  # Lógica interativa da aplicação (Leaflet, filtros e gráficos)
│
├── dados_acidentes.json       # Base consolidada de 9.950 sinistros em Franca/SP (2022-2026)
├── hotspots.geojson           # Geometrias dos 111 polígonos de risco delimitados (DBSCAN)
├── etl_metrics.json           # Métricas computacionais do processo de ETL
│
├── calcula_metricas_area.py   # Script de auditoria métrica e validação científica do benchmark
├── analise_espacial.py        # Algoritmo DBSCAN que gera os polígonos de risco
├── processador.py             # Script de extração e tratamento dos dados do Infosiga SP
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
* **WAZLAWICK, Raul Sidnei.** *Metodologia de Pesquisa para Ciência da Computação.* 2. ed. Rio de Janeiro: Elsevier, 2014.
