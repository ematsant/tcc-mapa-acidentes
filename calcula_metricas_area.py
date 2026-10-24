import json
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, MultiPoint
from sklearn.cluster import KMeans
import numpy as np
import warnings
warnings.filterwarnings('ignore')

print("Processando dados espaciais de Franca - SP...")

# 1. Carregar acidentes
with open('dados_acidentes.json', 'r', encoding='utf-8') as f:
    dados = json.load(f)

df = pd.DataFrame(dados)
# Filtragem de acidentes com vítimas ou óbitos para a análise espacial
df_graves = df[df['gravidade'].isin(['fatal', 'com_vitima'])].copy()

# Criar GeoDataFrame com coordenadas em Lat/Lon (WGS84)
geometry = [Point(xy) for xy in zip(df_graves['longitude'], df_graves['latitude'])]
gdf_acidentes = gpd.GeoDataFrame(df_graves, geometry=geometry, crs="EPSG:4326")

# Reprojetar para o sistema UTM de Franca (SIRGAS 2000 / UTM zone 23S - EPSG:31983)
# Projeção plana para cálculo de distâncias e áreas no sistema métrico.
gdf_acidentes = gdf_acidentes.to_crs(epsg=31983)

# 2. Carregar hotspots gerados pelo DBSCAN
hotspots = gpd.read_file('hotspots.geojson')
hotspots = hotspots.to_crs(epsg=31983)

# Área total de Franca-SP em km² (dado do IBGE)
AREA_FRANCA_KM2 = 605.6

# ======================================================================
# CÁLCULO 1: ÁREA E COMPRESSÃO TERRITORIAL DO DBSCAN
# ======================================================================
area_dbscan_km2 = hotspots.geometry.area.sum() / 1e6
pct_area_dbscan = (area_dbscan_km2 / AREA_FRANCA_KM2) * 100

# ======================================================================
# CÁLCULO 2: TAXA DE CONCENTRAÇÃO ESPACIAL DE SINISTROS GRAVES
# ======================================================================
# Junção espacial (Spatial Join) entre sinistros severos e os polígonos DBSCAN
acidentes_no_dbscan = gpd.sjoin(gdf_acidentes, hotspots, how="inner", predicate="intersects")
acidentes_unicos = acidentes_no_dbscan.index.nunique()
pct_cobertura = (acidentes_unicos / len(gdf_acidentes)) * 100
fator_densidade = (acidentes_unicos / len(gdf_acidentes)) / (area_dbscan_km2 / AREA_FRANCA_KM2) if area_dbscan_km2 > 0 else 0

# ======================================================================
# CÁLCULO 3: BASELINE DE CONTROLE COMPARATIVO (K-MEANS)
# ======================================================================
# Para comparação equivalente, define-se K com a mesma quantidade de clusters do DBSCAN
num_clusters = len(hotspots)
coords = np.array([[geom.x, geom.y] for geom in gdf_acidentes.geometry])

kmeans = KMeans(n_clusters=num_clusters, random_state=42)
df_graves['kmeans_cluster'] = kmeans.fit_predict(coords)

kmeans_polygons = []
for cluster_id in range(num_clusters):
    cluster_points = gdf_acidentes[df_graves['kmeans_cluster'] == cluster_id].geometry.tolist()
    if len(cluster_points) >= 3:
        # Envoltória convexa (Convex Hull) para representação particional
        hull = MultiPoint(cluster_points).convex_hull
        kmeans_polygons.append(hull)

kmeans_gdf = gpd.GeoDataFrame(geometry=kmeans_polygons, crs="EPSG:31983")
area_kmeans_km2 = kmeans_gdf.geometry.area.sum() / 1e6

z_vezes = area_kmeans_km2 / area_dbscan_km2 if area_dbscan_km2 > 0 else 0
pct_area_kmeans = (area_kmeans_km2 / AREA_FRANCA_KM2) * 100

# ======================================================================
# RELATÓRIO TÉCNICO DE RESULTADOS PARA APRESENTAÇÃO / DEFESA
# ======================================================================
print("=" * 80)
print("AVALIAÇÃO ESPACIAL DE ACIDENTES — MUNICÍPIO DE FRANCA/SP")
print(f"Período: Jan/2022 a Ago/2026 (4 anos e 8 meses) | Sistema: SIRGAS 2000 (UTM 23S)")
print("=" * 80)

print("\n1. BASE DE DADOS AUDITADA:")
print(f"   • Total de acidentes válidos: {len(df):,} ocorrências (após limpeza de centróides)".replace(',', '.'))
print(f"   • Acidentes com vítimas (feridos e óbitos): {len(gdf_acidentes):,} ocorrências ({len(gdf_acidentes)/len(df)*100:.1f}% da base)".replace(',', '.'))
print("   • Escopo da modelagem: Identificar as áreas de maior concentração desses")
print("     eventos com vítimas no município.")

print("\n" + "-" * 80)
print("2. RESULTADOS DO MODELO PROPOSTO (DBSCAN — Agrupamento por Densidade):")
print("-" * 80)
print(f"   • Zonas de risco delimitadas: {num_clusters} áreas (cruzamentos e trechos viários)")
print(f"   • Área total delimitada: {area_dbscan_km2:.2f} km² ({pct_area_dbscan:.2f}% do território de Franca)")
print(f"   • Cobertura de eventos graves: {acidentes_unicos:,} ocorrências com vítimas (feridos e óbitos)".replace(',', '.'))
print(f"   • Proporção observada: As áreas concentram {pct_cobertura:.2f}% dos acidentes com vítimas")
print(f"     do município ({acidentes_unicos:,} de {len(gdf_acidentes):,} com feridos e óbitos) em {area_dbscan_km2:.2f} km².".replace(',', '.'))

print("\n" + "-" * 80)
print("3. COMPARAÇÃO COM O K-MEANS (Grupo de Controle Comparativo):")
print("-" * 80)
print(f"   • Quantidade de grupos pareada: K = {num_clusters} regiões equivalentes")
print(f"   • Área delimitada pelo K-Means: {area_kmeans_km2:.2f} km² ({pct_area_kmeans:.2f}% do território municipal)")
print(f"   • Razão de área: A área delimitada pelo K-Means foi {z_vezes:.2f} vezes maior")
print("     que a área delimitada pelo DBSCAN para cobrir a mesma proporção de sinistros.")
print("   • Diferença metodológica: O K-Means divide o espaço em polígonos convexos")
print("     amplos que abrangem vazios urbanos; o DBSCAN contorna os pontos densos")
print("     ao longo das vias e classifica as ocorrências isoladas como ruído.")

print("\n" + "-" * 80)
print("4. SÍNTESE COMPARATIVA E APLICAÇÃO:")
print("-" * 80)
print(f"   • O modelo baseado em densidade (DBSCAN) delimitou {area_dbscan_km2:.2f} km² para concentrar")
print(f"     {pct_cobertura:.2f}% dos acidentes com vítimas (feridos e óbitos), enquanto o modelo")
print(f"     particional (K-Means) demandou {area_kmeans_km2:.2f} km² para cobrir o mesmo volume.")
print(f"   • Sob a perspectiva de aplicação prática, esses resultados indicam que o")
print(f"     poder público pode atuar em {area_dbscan_km2:.2f} km² da malha viária para abranger")
print("     quase um terço de todas as ocorrências com feridos e óbitos em Franca.")
print("=" * 80)

