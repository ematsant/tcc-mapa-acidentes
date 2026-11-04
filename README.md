# Mineração de Dados Espaciais para Segurança Viária

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-2ea44f?style=for-the-badge&logo=github)](https://ematsant.github.io/tcc-mapa-acidentes/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **Trabalho de Conclusão de Curso (TCC)** — Bacharelado em Ciência da Computação  
> **Instituição:** Universidade de Franca (UNIFRAN)  
> **Autor:** Matheus Moraes ([@ematsant](https://github.com/ematsant))  
> **Estudo de Caso:** Município de Franca – SP (2022–2026)  
> **Abordagem:** Aprendizado de Máquina Espacial por Densidade (DBSCAN) com Auditoria Algorítmica de Dados vs. Agrupamento Particional (K-Means)

---

> 🌐 **Demonstração Online no GitHub Pages:**  
> Acesse a plataforma Web GIS interativa em produção: **[https://ematsant.github.io/tcc-mapa-acidentes/](https://ematsant.github.io/tcc-mapa-acidentes/)**

---

## 📌 Visão Geral e Proposta de Valor

O monitoramento da segurança viária apoia-se em plataformas públicas consolidadas, como o **Sistema Infosiga SP**, que disponibiliza estatísticas abertas e mapas de calor para o acompanhamento do trânsito em todo o estado de São Paulo. Essa abordagem macro atende com excelência ao planejamento governamental e à formulação de políticas públicas gerais.

Contudo, quando equipes técnicas municipais precisam planejar intervenções físicas rápidas — como redesenho de cruzamentos perigosos, instalação de semáforos e reforço de sinalização —, surge a necessidade prática de **identificar e priorizar com agilidade** os locais mais críticos em meio a milhares de registros.

Este projeto propõe uma **solução analítica complementar de apoio à decisão**, composta por:
1. **Auditoria Espacial Algorítmica (*Data Cleaning*)**: Identificação e expurgo automatizado de coordenadas com empilhamento artificial de dados decorrentes de falhas de cadastro em boletins policiais (*fallback geocoding* e *point stacking*).
2. **Mineração de Dados Espaciais (DBSCAN)**: Delimitação de perímetros métricos fechados nos cruzamentos de maior risco, ponderando a severidade clínica das vítimas (*weighted casualties*) e custos sociais estimados pelo **IPEA (2020)**.
3. **Plataforma Web GIS Interativa**: Visualização cartográfica no navegador com filtros dinâmicos em tempo real (anos, gravidade, turnos, modais de transporte envolvidos) e latência inferior a 50 milissegundos.

---

## 🛡️ Auditoria Espacial de Dados (Data Cleaning)

As bases abertas do Infosiga SP consolidam ocorrências registradas em Boletins de Ocorrência da Polícia Militar e Civil. Na análise espacial urbana, quando um registro não possui o número predial exato ou refere-se a rotatórias sem número cadastrado, os sistemas automatizados de geocodificação atribuem o acidente às coordenadas centrais (centróide) da via ou do CEP.

Ao processar dados brutos sem auditoria, esses pontos artificiais geram manchas falsas de alto risco. Para solucionar essa distorção antes do agrupamento espacial, o pipeline de pré-processamento (`processador.py`) agrupa registros com proximidade de até 11 metros e aplica **três regras de auditoria simultâneas**, fundamentadas no comportamento real da malha urbana:

1. **Ter no mínimo 8 acidentes no mesmo ponto:** Margem de segurança para analisar apenas locais com grande acúmulo de dados, evitando descartar endereços legítimos com poucas ocorrências por engano.
2. **Conter acidentes de 5 ou mais ruas diferentes:** Uma esquina física real conecta apenas 2 ou 3 vias (ou no máximo 4 em uma rotatória). Conter 5 ou mais nomes de ruas distintos em uma única coordenada evidencia que o ponto não é uma esquina física, mas uma concentração artificial gerada por falta do número do imóvel no boletim policial.
3. **Apresentar dispersão de endereços igual ou superior a 50% (Razão $R = U / N \ge 0{,}5$):** Em um cruzamento perigoso real, quase todos os acidentes acontecem nas mesmas ruas confluentes daquela esquina. Já no ponto com defeito de cadastro, quase cada boletim cita uma rua diferente da cidade. Essa regra confirma que os endereços foram misturados, garantindo que os cruzamentos perigosos reais permaneçam no mapa.

### 📊 Impacto da Auditoria em Franca/SP (2022–2026):
* **Registros brutos iniciais:** 9.950 acidentes
* **Pontos artificiais de centróide detectados:** 11 coordenadas geográficas anômalas
* **Registros inconsistentes expurgados:** 691 acidentes sem localização física real
* **Base espacial legítima mantida:** **9.259 acidentes fidedignos**

---

## 🔬 Resultados e Comparativo Científico de Modelagem Espacial

A modelagem espacial foi processada no sistema geodésico métrico oficial brasileiro (**SIRGAS 2000 / UTM zone 23S - EPSG:31983**). Para validar o ganho de foco geográfico, o algoritmo **DBSCAN** foi comparado diretamente ao modelo de controle tradicional **K-Means**, pareado com a mesma quantidade de 107 grupos:

| Métrica Avaliada | DBSCAN (Densidade Proposto) | K-Means (Controle Baseline) | Razão / Ganho de Precisão |
| :--- | :---: | :---: | :---: |
| **Quantidade de Zonas de Risco** | **107 polígonos delimitados** | 107 grupos pareados | Parâmetro equivalente ($K = 107$) |
| **Cobertura de Sinistros Graves** | **31,56%** (1.817 com vítimas e mortes) | 31,56% (pareado) | Mesma proporção de sinistros |
| **Área Territorial Delimitada** | **0,95 km²** (952.200 m²) | 62,79 km² (62.790.000 m²) | **K-Means é 65,94 vezes maior** |
| **Ocupação do Município (605,68 km²)**| **0,16% do território de Franca** | 10,37% do território de Franca | Foco restrito com 10,21 p.p. a menos |
| **Geometria dos Polígonos** | Envoltórias côncavas livres (*Concave Hull*) | Agrupamentos circulares/convexos rígidos | Acompanha o traçado real das vias |
| **Tratamento de Ocorrências Isoladas**| Classificadas como **ruído estatístico** | Forçadas ao cluster mais próximo | Não infla as áreas com eventos isolados |

> **Síntese dos Resultados:** O algoritmo DBSCAN concentrou **quase um terço de todas as mortes e feridos graves** (31,56%) em apenas **0,95 km²** da cidade (0,16% da área municipal). Para abranger essa mesma quantidade de acidentes graves, o modelo de controle K-Means exigiu **62,79 km² — uma extensão 65,94 vezes maior**. Isso comprova a eficácia do modelo para orientar vistorias e intervenções em esquinas específicas com alto retorno social.

---

## 🏛️ Arquitetura da Solução e Decisões de Engenharia

O projeto adota o padrão arquitetural clássico **Dutos e Filtros (*Pipes and Filters*)**, operando em dois eixos complementares:

```text
Microdados Brutos Infosiga SP (CSV)
                │
                ▼
┌──────────────────────────────────────────────┐
│  Módulo de Pré-processamento (Python)        │
│  • processador.py: Limpeza, Auditoria de      │
│    Centróides (R = U/N) e Ponderação IPEA    │
└──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  Módulo de Mineração Espacial (Python)       │
│  • analise_espacial.py: Projeção UTM 23S,    │
│    DBSCAN métrico (eps=50m) e Concave Hull   │
└──────────────────────────────────────────────┘
                │
                ▼
     Arquivos Estruturados Estáticos
     (dados_acidentes.json & hotspots.geojson)
                │
                ▼
┌──────────────────────────────────────────────┐
│  Plataforma Web GIS (Client-Side)            │
│  • HTML5 / CSS3 / JavaScript (Leaflet.js)    │
│  • Processamento local in-memory (< 50 ms)   │
│  • Hospedagem estática no GitHub Pages       │
└──────────────────────────────────────────────┘
```

### Por que dispensar banco de dados relacional (SGBD) no servidor?
* **Dados Históricos Read-Only:** Sinistros de trânsito consolidados são dados históricos imutáveis, consultados exclusivamente para leitura analítica.
* **Processamento Prévio em Lote (*Batch Processing*):** Todo o cálculo computacional pesado de auditoria e clustering é executado previamente pelo pipeline em Python, gerando documentos estáticos compactos.
* **Desempenho e Latência:** Os arquivos são mantidos diretamente na memória do navegador cliente, permitindo filtragens instantâneas com latência inferior a 50 milissegundos.
* **Custo Zero e Segurança:** A hospedagem estática no GitHub Pages garante disponibilidade resiliente sem custos operacionais de servidores e elimina superfícies de ataque comuns em bancos dinâmicos (como injeção de SQL).

---

## 🚦 Modais de Transporte e Custos Sociais (IPEA)

A aplicação detalha o perfil local das ocorrências para embasar intervenções direcionadas para cada tipo de modal:
* **Modais Analisados:** Automóveis, Motocicletas, Bicicletas, Caminhões, Ônibus e Pedestres (atropelamentos).
* **Ponderação por Severidade Clínica:** Atribuição de pesos diferenciados (Óbitos: peso 5, Feridos: peso 2, Apenas danos materiais: peso 1), fundamentado em Kričković et al. (2024).
* **Valoração Econômica:** Integração com os parâmetros do Instituto de Pesquisa Econômica Aplicada (**IPEA, 2020**), quantificando perda de produção das vítimas e custos médico-hospitalares para direcionamento prioritário de recursos.

---

## 🛠️ Como Executar e Reproduzir o Projeto Localmente

### Pré-requisitos
* **Python 3.10 ou superior**
* **Navegador web moderno** (Chrome, Firefox, Safari, Edge)

### 1. Clonar o repositório
```bash
git clone https://github.com/ematsant/tcc-mapa-acidentes.git
cd tcc-mapa-acidentes
```

### 2. Configurar o ambiente virtual Python
```bash
# Criação do ambiente virtual
python3 -m venv venv

# Ativação do ambiente
source venv/bin/activate  # No Windows: venv\Scripts\activate

# Instalação das dependências
pip install -r requirements.txt
```

### 3. Reproduzir a auditoria e os modelos espaciais
```bash
# Etapa 1: Executar a validação métrica comparativa DBSCAN vs. K-Means
python calcula_metricas_area.py

# Etapa 2: Gerar os polígonos de risco em GeoJSON
python analise_espacial.py

# (Opcional) Reprocessar pipeline de ETL desde os dados brutos:
# python processador.py
```

### 4. Executar a aplicação web localmente
Por utilizar arquivos `.json` e `.geojson`, a aplicação deve ser servida via protocolo HTTP local para evitar bloqueios de segurança de CORS:

```bash
# Inicia um servidor HTTP local na porta 8000
python3 -m http.server 8000
```
Acesse no navegador:
* **Mapa Interativo Principal:** [http://localhost:8000/index.html](http://localhost:8000/index.html)
* **Página de Metodologia e Benchmark:** [http://localhost:8000/metodologia.html](http://localhost:8000/metodologia.html)

---

## 📂 Estrutura de Arquivos do Repositório

```text
├── index.html                 # Interface web principal do mapa interativo (GitHub Pages)
├── metodologia.html           # Página dedicada de metodologia, KPIs e benchmark
├── style.css                  # Folha de estilos responsiva com suporte a Dark Mode
├── script.js                  # Lógica client-side (Leaflet.js, Chart.js, filtros e KPIs)
│
├── dados_acidentes.json       # Base com 9.259 sinistros auditados de Franca/SP (2022–2026)
├── hotspots.geojson           # Geometrias vetoriais dos 107 polígonos de risco (DBSCAN)
├── etl_metrics.json           # Log da auditoria de centróides e métricas de execução ETL
│
├── calcula_metricas_area.py   # Script de validação métrica do benchmark DBSCAN vs. K-Means
├── analise_espacial.py        # Algoritmo DBSCAN que gera os polígonos de risco em GeoJSON
├── processador.py             # Pipeline de extração, auditoria espacial e higienização de dados
│
├── requirements.txt           # Dependências Python (pandas, geopandas, shapely, scikit-learn)
├── .gitignore                 # Regras de exclusão do Git
├── LICENSE                    # Licença MIT de código aberto
└── README.md                  # Documentação completa do projeto
```

---

## 📚 Referências Bibliográficas

* **ANDERSON, T. K.** Kernel density estimation and hotspot mapping. *Policing: An International Journal of Police Strategies & Management*, v. 32, n. 1, p. 35-51, 2009.
* **ESTER, M. et al.** A density-based algorithm for discovering clusters in large spatial databases with noise. In: *Proceedings of the Second International Conference on Knowledge Discovery and Data Mining (KDD-96)*. AAAI Press, 1996. p. 226-231.
* **IPEA – INSTITUTO DE PESQUISA ECONÔMICA APLICADA.** *Custos dos acidentes de trânsito no Brasil: estimativas atualizadas*. Brasília: IPEA, 2020.
* **KRIČKOVIĆ, E. et al.** Spatial analysis of road traffic crashes using GIS and spatial statistics. *Applied Geography*, v. 165, p. 103233, 2024.
* **SÃO PAULO (Estado).** *Sistema Infosiga SP: Dados abertos de acidentes de trânsito*. Departamento Estadual de Trânsito (Detran-SP), 2026.
* **TRANSPORTATION RESEARCH BOARD.** *Highway Safety Manual (HSM)*. Washington, D.C.: AASHTO, 2010.
* **WAZLAWICK, R. S.** *Metodologia de pesquisa para ciência da computação*. 3. ed. Rio de Janeiro: Elsevier, 2021.
* **ZANDBERGEN, P. A.** A comparison of address point, parcel and street geocoding techniques. *Computers, Environment and Urban Systems*, v. 32, n. 3, p. 214-225, 2008.

---

## 👤 Autor e Informações Acadêmicas

* **Autor:** Matheus Moraes ([@ematsant](https://github.com/ematsant))
* **Curso:** Bacharelado em Ciência da Computação
* **Instituição:** Universidade de Franca (UNIFRAN)
* **Orientação:** Trabalho de Conclusão de Curso (TCC)
* **Ano:** 2026

---

## 📄 Licença

Este projeto é distribuído sob a licença [MIT](LICENSE) — livre para estudos acadêmicos, uso público e implementações em prol da segurança viária.
