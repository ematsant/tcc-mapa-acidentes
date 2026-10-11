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
# CÁLCULO 2: TAXA DE COBERTURA ESPACIAL DE SINISTROS GRAVES
# ======================================================================
# Junção espacial (Spatial Join) entre sinistros severos e os polígonos DBSCAN
acidentes_no_dbscan = gpd.sjoin(gdf_acidentes, hotspots, how="inner", predicate="intersects")
acidentes_unicos = acidentes_no_dbscan.index.nunique()
pct_cobertura = (acidentes_unicos / len(gdf_acidentes)) * 100

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
print("=" * 70)
print("RELATÓRIO DE AVALIAÇÃO ESPACIAL E RESULTADOS (TCC)")
print("Município: Franca - SP | Projeção: SIRGAS 2000 / UTM 23S (EPSG:31983)")
print("=" * 70)

print("\n1. MODELO DBSCAN (Agrupamento por Densidade):")
print(f"   • Acidentes com Vítimas e Óbitos: {pct_cobertura:.2f}%")
print(f"   • Área Total Delimitada: {area_dbscan_km2:.2f} km²")
print(f"   • Ocupação Territorial: {pct_area_dbscan:.2f}% de Franca (total de {AREA_FRANCA_KM2} km²)")

print("\n2. MODELO K-MEANS (Controle Particional):")
print(f"   • Quantidade de Grupos Pareada: {num_clusters}")
print(f"   • Área Total Delimitada: {area_kmeans_km2:.2f} km²")
print(f"   • Ocupação Territorial: {pct_area_kmeans:.2f}% de Franca")

print("\n3. COMPARAÇÃO DOS RESULTADOS:")
print(f"   • Razão de Área: O K-Means ocupou uma área {z_vezes:.2f} vezes maior que o DBSCAN.")
print(f"   • Síntese: As {num_clusters} áreas de risco concentram {pct_cobertura:.2f}% dos acidentes com vítimas e óbitos")
print(f"     em {pct_area_dbscan:.2f}% do território de Franca ({area_dbscan_km2:.2f} km² de {AREA_FRANCA_KM2} km²).")
print("=" * 70)

