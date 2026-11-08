/* =========================================================
   Mineração de Dados Espaciais para Segurança Viária | TCC
   script.js – Lógica principal: mapa, filtros, gráfico, tema
   ========================================================= */

// ── Configuração Inicial do Mapa ──────────────────────────
const FRANCA_COORDS = [-20.5383, -47.4008];
const ZOOM_INICIAL  = 13;
const FRANCA_BOUNDS = [
    [-20.80, -47.65], // Sudoeste
    [-20.35, -47.15]  // Nordeste
];

const mapa = L.map('mapa', {
    zoomControl: false,
    minZoom: 11,
    maxBounds: FRANCA_BOUNDS,
    maxBoundsViscosity: 1.0
}).setView(FRANCA_COORDS, ZOOM_INICIAL);
L.control.zoom({ position: 'bottomright' }).addTo(mapa);

// ── Tile Layers (claro e escuro) ─────────────────────────
// Ambos usam OpenStreetMap gratuito – sem necessidade de API key.
// O tema escuro aplica um filtro CSS de inversão de cores.
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const tileClaro = L.tileLayer(OSM_URL, {
    maxZoom: 19,
    attribution: OSM_ATTR,
    className: 'tile-claro'
});

// Mesmo tile, mas com classe CSS que aplica filtro de inversão de cores
const tileEscuro = L.tileLayer(OSM_URL, {
    maxZoom: 19,
    attribution: OSM_ATTR,
    className: 'tile-escuro'
});

// Inicia com o tile claro ou restaura preferência salva
const temaSalvoInicial = localStorage.getItem('theme') || 'light';
let tileAtual = (temaSalvoInicial === 'dark') ? tileEscuro : tileClaro;
tileAtual.addTo(mapa);

if (temaSalvoInicial === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.addEventListener('DOMContentLoaded', () => {
        const icon = document.getElementById('theme-icon');
        if (icon) icon.className = 'fas fa-sun';
    });
}

// ── Variáveis de Controle ─────────────────────────────────
let dadosOriginais    = [];
let clusterLayer      = L.markerClusterGroup();
let heatLayer         = null;
let usandoMapaDeCalor = false;
let mostrandoMarcadores = true;
let graficoChart      = null;

let hotspotsLayer     = null;
let mostrandoHotspots = false;
let geojsonHotspotsData = null;

// Carregar Zonas de Risco geradas pelo DBSCAN
fetch('hotspots.geojson')
    .then(r => r.json())
    .then(data => { 
        geojsonHotspotsData = data; 
        const countSpan = document.getElementById('hotspots-count');
        if (countSpan && data.features) {
            countSpan.textContent = `(${data.features.length})`;
        }
    })
    .catch(err => console.warn('Zonas de risco não carregadas. Execute analise_espacial.py primeiro.'));

// ── Ícones coloridos por gravidade ───────────────────────
function criarIcone(gravidade) {
    const cores = {
        fatal:      '#e74c3c',
        com_vitima: '#f39c12',
        sem_vitima: '#2ecc71'
    };
    const cor = cores[gravidade] || '#3498db';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const strokeColor = isDark ? '#2a2a3a' : '#fff';
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                  fill="${cor}" stroke="${strokeColor}" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
        </svg>`;
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    return L.icon({ iconUrl: url, iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -34] });
}

// ── Leitura do JSON ───────────────────────────────────────
fetch('dados_acidentes.json')
    .then(r => r.json())
    .then(data => {
        dadosOriginais = data;
        popularFiltrosDinamicos();
        atualizarMapa(dadosOriginais);
        atualizarContadorECusto(dadosOriginais);
        renderizarGrafico(dadosOriginais);
    })
    .catch(err => {
        console.error('Erro ao carregar JSON:', err);
        document.getElementById('contador').textContent = '⚠️ Erro ao carregar dados. Execute processador.py primeiro.';
    });

// ── Filtros Dinâmicos ─────────────────────────────────────
function popularFiltrosDinamicos() {
    const preencher = (idSelect, chave) => {
        const select = document.getElementById(idSelect);
        const valores = [...new Set(dadosOriginais.map(d => d[chave]))].sort();
        valores.forEach(v => {
            if (v && v !== 'Desconhecido' && v !== 'nan' && v !== 'NÃO INFORMADO') {
                select.appendChild(new Option(v, v));
            }
        });
    };
    const ordemDias = {
        'Domingo': 1, 'Segunda-feira': 2, 'Terça-feira': 3, 
        'Quarta-feira': 4, 'Quinta-feira': 5, 'Sexta-feira': 6, 'Sábado': 7
    };

    const preencherDias = (idSelect, chave) => {
        const select = document.getElementById(idSelect);
        const valores = [...new Set(dadosOriginais.map(d => d[chave]))]
            .filter(v => v && v !== 'Desconhecido' && v !== 'nan' && v !== 'NÃO INFORMADO')
            .sort((a, b) => (ordemDias[a] || 99) - (ordemDias[b] || 99));
        valores.forEach(v => select.appendChild(new Option(v, v)));
    };

    const preencherVeiculos = (idSelect, chave) => {
        const select = document.getElementById(idSelect);
        let todosVeiculos = [];
        dadosOriginais.forEach(d => {
            if (d[chave] && d[chave] !== 'NÃO INFORMADO' && d[chave] !== 'nan' && d[chave] !== 'Desconhecido') {
                const partes = d[chave].split(',').map(s => s.trim());
                todosVeiculos.push(...partes);
            }
        });
        const valoresUnicos = [...new Set(todosVeiculos)].sort();
        valoresUnicos.forEach(v => select.appendChild(new Option(v, v)));
    };

    const ordemTurnos = {
        'MADRUGADA': 1, 'MANHA': 2, 'TARDE': 3, 'NOITE': 4, 'NAO DISPONIVEL': 5
    };

    const preencherTurnos = (idSelect, chave) => {
        const select = document.getElementById(idSelect);
        const valores = [...new Set(dadosOriginais.map(d => d[chave]))]
            .filter(v => v && v !== 'Desconhecido' && v !== 'nan')
            .sort((a, b) => (ordemTurnos[a] || 99) - (ordemTurnos[b] || 99));
        valores.forEach(v => select.appendChild(new Option(v, v)));
    };

    preencher('ano-inicial',         'ano');
    preencher('ano-final',           'ano');
    
    // Set default min and max years
    const anos = [...new Set(dadosOriginais.map(d => d.ano))].filter(v => v !== 'Desconhecido' && v !== 'nan' && v !== 'NÃO INFORMADO').sort();
    if (anos.length > 0) {
        document.getElementById('ano-inicial').value = anos[0];
        document.getElementById('ano-final').value = anos[anos.length - 1];
    }

    preencherTurnos('turno-filtro',  'turno');
    preencherDias('dia-semana-filtro',   'dia_semana');
    preencher('tipo-sinistro-filtro','tipo_sinistro');
    preencherVeiculos('tipo-veiculo-filtro', 'tipo_veiculo');
}

document.getElementById('btn-aplicar-filtros').addEventListener('click', aplicarFiltros);

// Ouvintes de alteração dinâmica em tempo real nos filtros
[
    'ano-inicial', 'ano-final', 'gravidade-filtro', 'turno-filtro',
    'dia-semana-filtro', 'tipo-sinistro-filtro', 'tipo-veiculo-filtro'
].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', aplicarFiltros);
});

document.getElementById('toggle-heatmap').addEventListener('change', e => {
    usandoMapaDeCalor = e.target.checked;
    aplicarFiltros();
});

document.getElementById('toggle-marcadores').addEventListener('change', e => {
    mostrandoMarcadores = e.target.checked;
    aplicarFiltros();
});

document.getElementById('toggle-hotspots').addEventListener('change', e => {
    mostrandoHotspots = e.target.checked;
    aplicarFiltros();
});

function aplicarFiltros() {
    let fAnoInicial = document.getElementById('ano-inicial').value;
    let fAnoFinal   = document.getElementById('ano-final').value;

    // Auto-corrigir se ano inicial for maior que ano final
    if (fAnoInicial > fAnoFinal) {
        fAnoFinal = fAnoInicial;
        document.getElementById('ano-final').value = fAnoFinal;
    }
    const fGrav     = document.getElementById('gravidade-filtro').value;
    const fTurno    = document.getElementById('turno-filtro').value;
    const fDia      = document.getElementById('dia-semana-filtro').value;
    const fSinistro = document.getElementById('tipo-sinistro-filtro').value;
    const fVeiculo  = document.getElementById('tipo-veiculo-filtro').value;

    const filtrados = dadosOriginais.filter(d =>
        (d.ano >= fAnoInicial && d.ano <= fAnoFinal) &&
        (fGrav     === 'todos' || d.gravidade     === fGrav)     &&
        (fTurno    === 'todos' || d.turno         === fTurno)    &&
        (fDia      === 'todos' || d.dia_semana    === fDia)      &&
        (fSinistro === 'todos' || d.tipo_sinistro === fSinistro) &&
        (fVeiculo  === 'todos' || (d.tipo_veiculo && d.tipo_veiculo.includes(fVeiculo)))
    );

    atualizarMapa(filtrados);
    atualizarContadorECusto(filtrados);
    renderizarGrafico(filtrados);
}

function atualizarContadorECusto(filtrados) {
    document.getElementById('contador').innerHTML = `<i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> <b>${filtrados.length.toLocaleString('pt-BR')}</b> acidentes exibidos`;
    
    const custoTotal = filtrados.reduce((acc, curr) => acc + (curr.custo_social || 0), 0);
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('custo-social-total').textContent = formatter.format(custoTotal);
}

// Retorna os dados filtrados atualmente (para uso no tema toggle etc.)
function obterDadosFiltradosAtual() {
    let fAnoInicial = document.getElementById('ano-inicial').value;
    let fAnoFinal   = document.getElementById('ano-final').value;

    if (fAnoInicial > fAnoFinal) {
        fAnoFinal = fAnoInicial;
        document.getElementById('ano-final').value = fAnoFinal;
    }
    const fGrav     = document.getElementById('gravidade-filtro').value;
    const fTurno    = document.getElementById('turno-filtro').value;
    const fDia      = document.getElementById('dia-semana-filtro').value;
    const fSinistro = document.getElementById('tipo-sinistro-filtro').value;
    const fVeiculo  = document.getElementById('tipo-veiculo-filtro').value;

    return dadosOriginais.filter(d =>
        (d.ano >= fAnoInicial && d.ano <= fAnoFinal) &&
        (fGrav     === 'todos' || d.gravidade     === fGrav)     &&
        (fTurno    === 'todos' || d.turno         === fTurno)    &&
        (fDia      === 'todos' || d.dia_semana    === fDia)      &&
        (fSinistro === 'todos' || d.tipo_sinistro === fSinistro) &&
        (fVeiculo  === 'todos' || (d.tipo_veiculo && d.tipo_veiculo.includes(fVeiculo)))
    );
}



// ── Renderização do Mapa ──────────────────────────────────
function atualizarMapa(dados) {
    const t0 = performance.now(); // Início da medição de performance
    
    mapa.removeLayer(clusterLayer);
    clusterLayer.clearLayers();
    if (heatLayer) { mapa.removeLayer(heatLayer); heatLayer = null; }
    if (hotspotsLayer) { mapa.removeLayer(hotspotsLayer); hotspotsLayer = null; }

    const pontosHeat = [];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const formatterMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    dados.forEach(d => {
        if (usandoMapaDeCalor) {
            const peso = d.gravidade === 'fatal' ? 1.0 : (d.gravidade === 'com_vitima' ? 0.65 : 0.35);
            pontosHeat.push([d.latitude, d.longitude, peso]);
        }
        if (mostrandoMarcadores) {
            const marcador = L.marker([d.latitude, d.longitude], { icon: criarIcone(d.gravidade) });
            const rotulo = {
                fatal:      '<i class="fas fa-skull-crossbones"></i> Fatal',
                com_vitima: '<i class="fas fa-ambulance"></i> Com Vítima',
                sem_vitima: '<i class="fas fa-car-crash"></i> Sem Vítima'
            }[d.gravidade] || '<i class="fas fa-question-circle"></i> Não Informada';

            // Popup com cores EXPLÍCITAS – nunca usa var(--text)
            // Fundo do popup: branco no claro, cinza escuro no escuro
            const popupBg     = isDark ? '#1e2030' : '#ffffff';
            const popupText   = isDark ? '#e0e0e0' : '#333333';
            const popupBold   = isDark ? '#ffffff' : '#1a1a2e';
            const headerBg    = 'linear-gradient(135deg,#3498db,#2176ae)';
            const borderCol   = isDark ? '#2b2e44' : '#e6e8ec';
            const custoSocial = d.custo_social ? formatterMoeda.format(d.custo_social) : 'Não informado';

            // Badge de gravidade (vermelho: fatal, laranja: com vítima, verde: sem vítima, azul: não informada)
            const badgeBg    = d.gravidade === 'fatal' ? (isDark ? '#5c1a1a' : '#fdecea')
                             : d.gravidade === 'com_vitima' ? (isDark ? '#5c4a10' : '#fef9e7')
                             : d.gravidade === 'sem_vitima' ? (isDark ? '#133d24' : '#eafaf1')
                             : (isDark ? '#1a2e4c' : '#ebf5fb');
            const badgeColor = d.gravidade === 'fatal' ? (isDark ? '#f5a8a1' : '#c0392b')
                             : d.gravidade === 'com_vitima' ? (isDark ? '#f5d98a' : '#b7770d')
                             : d.gravidade === 'sem_vitima' ? (isDark ? '#82e6b0' : '#1e8449')
                             : (isDark ? '#90caf9' : '#2980b9');

            marcador.bindPopup(`
                <div style="font-family:'Inter',sans-serif;font-size:13px;min-width:250px;background:${popupBg};color:${popupText};border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.18);">
                    <div style="background:${headerBg};color:#fff;padding:10px 34px 10px 16px;font-weight:700;font-size:14px;">
                        <i class="fas fa-file-alt"></i> Detalhes do Acidente
                    </div>
                    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
                        <div><b style="color:${popupBold}"><i class="fas fa-calendar"></i> Data:</b> ${d.data || 'Não informado'}</div>
                        <div><b style="color:${popupBold}"><i class="fas fa-clock"></i> Turno:</b> ${d.turno || 'Não informado'}</div>
                        <div><b style="color:${popupBold}"><i class="fas fa-calendar-day"></i> Dia:</b> ${d.dia_semana || 'Não informado'}</div>
                        <div><b style="color:${popupBold}"><i class="fas fa-car"></i> Veículos:</b> ${d.tipo_veiculo || 'Não informado'}</div>
                        <div><b style="color:${popupBold}"><i class="fas fa-exclamation-circle"></i> Tipo:</b> ${d.tipo_sinistro || 'Não informado'}</div>
                        <div style="border-top:1px dashed ${borderCol};padding-top:6px;">
                            <b style="color:${popupBold}"><i class="fas fa-coins"></i> Custo Social (IPEA):</b> <span style="color:#e74c3c;font-weight:700;">${custoSocial}</span>
                        </div>
                        <div style="margin-top:2px;padding:5px 8px;border-radius:6px;background:${badgeBg};font-weight:700;color:${badgeColor};text-align:center;">
                            ${rotulo}
                        </div>
                    </div>
                </div>
            `, { minWidth: 260, className: 'custom-popup-infosiga' });

            clusterLayer.addLayer(marcador);
        }
    });

    if (usandoMapaDeCalor && pontosHeat.length > 0) {
        heatLayer = L.heatLayer(pontosHeat, { radius: 25, blur: 15, maxZoom: 15 });
        heatLayer.addTo(mapa);
    }
    if (mostrandoMarcadores) {
        clusterLayer.addTo(mapa);
    }
    
    // Adicionar Zonas de Risco (DBSCAN) se o toggle estiver ativo
    if (mostrandoHotspots && geojsonHotspotsData) {
        hotspotsLayer = L.geoJSON(geojsonHotspotsData.features, {
            style: function(feature) {
                return {
                    color: '#e74c3c',
                    weight: 3,
                    opacity: 0.9,
                    fillColor: '#c0392b',
                    fillOpacity: 0.3,
                    dashArray: '5, 5'
                };
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                const custoFormatado = props.custo_social ? formatterMoeda.format(props.custo_social) : 'Sob consulta';
                const naoInf = props.nao_informado !== undefined ? props.nao_informado : (props.qtd_acidentes - props.fatais - props.com_vitima - (props.sem_vitima || 0));
                
                const popupBg   = isDark ? '#1e2030' : '#ffffff';
                const popupText = isDark ? '#e0e0e0' : '#333333';
                const popupBold = isDark ? '#ffffff' : '#1a1a2e';
                const headerBg  = 'linear-gradient(135deg, #c0392b, #962d22)';
                const cardBg    = isDark ? '#151724' : '#f8f9fa';
                const borderCol = isDark ? '#2b2e44' : '#e6e8ec';

                const htmlPopup = `
                    <div style="font-family:'Inter',sans-serif;font-size:13px;min-width:270px;background:${popupBg};color:${popupText};border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.18);">
                        <div style="background:${headerBg};color:#fff;padding:10px 34px 10px 16px;font-weight:700;font-size:14px;display:flex;align-items:center;">
                            <span><i class="fas fa-shield-alt"></i> Agrupamento #${props.cluster_id}</span>
                            <span style="font-size:10px;font-weight:600;background:rgba(255,255,255,0.22);padding:2px 6px;border-radius:4px;margin-left:8px;">DBSCAN</span>
                        </div>
                        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
                            <!-- Custo Social IPEA -->
                            <div style="background:${cardBg};border:1px solid ${borderCol};border-radius:8px;padding:8px 10px;text-align:center;">
                                <div style="font-size:10px;color:${isDark ? '#9da3b4' : '#6c757d'};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Custo Social Estimado (IPEA)</div>
                                <div style="font-size:16px;font-weight:800;color:#e74c3c;margin-top:2px;">${custoFormatado}</div>
                            </div>

                            <!-- Histórico de Severidade -->
                            <div>
                                <div style="font-size:10px;font-weight:700;color:${isDark ? '#9da3b4' : '#6c757d'};text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px;">Sinistros no Período (${props.periodo})</div>
                                <div style="display:flex;justify-content:space-between;background:${cardBg};border:1px solid ${borderCol};border-radius:6px;padding:6px 8px;font-size:11px;">
                                    <span><b>Total:</b> ${props.qtd_acidentes}</span>
                                    <span style="color:#e74c3c;"><b>Fatais:</b> ${props.fatais}</span>
                                    <span style="color:#f39c12;"><b>Com Vítima:</b> ${props.com_vitima}</span>
                                    <span style="color:#2ecc71;"><b>Sem Vítima:</b> ${props.sem_vitima ?? 0}</span>
                                    ${naoInf > 0 ? `<span style="color:#3498db;"><b>Não Inf.:</b> ${naoInf}</span>` : ''}
                                </div>
                            </div>

                            <!-- Perfil de Modais -->
                            <div>
                                <div style="font-size:10px;font-weight:700;color:${isDark ? '#9da3b4' : '#6c757d'};text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px;">Perfil dos Veículos Envolvidos</div>
                                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                    <div style="flex:1;min-width:60px;background:${cardBg};border:1px solid ${borderCol};border-radius:6px;padding:5px 4px;text-align:center;">
                                        <div style="font-size:11px;color:${isDark ? '#f5d98a' : '#b7770d'};font-weight:600;"><i class="fas fa-motorcycle"></i> Motos</div>
                                        <div style="font-size:13px;font-weight:800;color:${popupBold};">${props.pct_motos ?? 0}%</div>
                                    </div>
                                    <div style="flex:1;min-width:60px;background:${cardBg};border:1px solid ${borderCol};border-radius:6px;padding:5px 4px;text-align:center;">
                                        <div style="font-size:11px;color:${isDark ? '#90caf9' : '#1976d2'};font-weight:600;"><i class="fas fa-car"></i> Carros</div>
                                        <div style="font-size:13px;font-weight:800;color:${popupBold};">${props.pct_carros ?? 0}%</div>
                                    </div>
                                    ${(props.pct_pesados > 0) ? `
                                    <div style="flex:1;min-width:60px;background:${cardBg};border:1px solid ${borderCol};border-radius:6px;padding:5px 4px;text-align:center;">
                                        <div style="font-size:11px;color:${isDark ? '#a5d6a7' : '#388e3c'};font-weight:600;"><i class="fas fa-truck"></i> Pesados</div>
                                        <div style="font-size:13px;font-weight:800;color:${popupBold};">${props.pct_pesados}%</div>
                                    </div>` : ''}
                                    ${(props.pct_bicicletas > 0) ? `
                                    <div style="flex:1;min-width:60px;background:${cardBg};border:1px solid ${borderCol};border-radius:6px;padding:5px 4px;text-align:center;">
                                        <div style="font-size:11px;color:${isDark ? '#ce93d8' : '#7b1fa2'};font-weight:600;"><i class="fas fa-bicycle"></i> Bicicletas</div>
                                        <div style="font-size:13px;font-weight:800;color:${popupBold};">${props.pct_bicicletas}%</div>
                                    </div>` : ''}
                                </div>
                            </div>

                            <!-- Padrão Temporal Crítico -->
                            <div style="font-size:11px;color:${popupText};background:${cardBg};border:1px solid ${borderCol};border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
                                <span><b style="color:${popupBold}"><i class="fas fa-clock"></i> Turno:</b> ${props.turno_critico || 'N/A'}</span>
                                <span><b style="color:${popupBold}"><i class="fas fa-calendar-day"></i> Dia:</b> ${props.dia_critico || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `;

                layer.bindPopup(htmlPopup, { minWidth: 280, className: 'custom-popup-infosiga' });

                layer.on({
                    mouseover: function(e) {
                        e.target.setStyle({ weight: 4, fillOpacity: 0.5, dashArray: '' });
                    },
                    mouseout: function(e) {
                        hotspotsLayer.resetStyle(e.target);
                    }
                });
            }
        });
        hotspotsLayer.addTo(mapa);
    }
    
    const t1 = performance.now(); // Fim da medição de performance
    const renderTimeMsg = `Tempo de renderização: ${(t1 - t0).toFixed(1)} ms`;
    const elMetricas = document.getElementById('metricas-frontend');
    if (elMetricas) elMetricas.textContent = renderTimeMsg;
}

// ── Gráfico de Estatísticas (Chart.js) ───────────────────
function renderizarGrafico(dados) {
    const contagem = { fatal: 0, com_vitima: 0, sem_vitima: 0, 'NÃO INFORMADO': 0 };
    dados.forEach(d => {
        if (contagem[d.gravidade] !== undefined) {
            contagem[d.gravidade]++;
        } else {
            contagem['NÃO INFORMADO']++;
        }
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e8eaf6' : '#1a1a2e';

    if (graficoChart) graficoChart.destroy();

    const ctx = document.getElementById('statsChart').getContext('2d');
    graficoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Fatal', 'Com Vítima', 'Sem Vítima', 'Não Informada'],
            datasets: [{
                data: [contagem.fatal, contagem.com_vitima, contagem.sem_vitima, contagem['NÃO INFORMADO']],
                backgroundColor: ['#e74c3c', '#f39c12', '#2ecc71', '#3498db'],
                borderColor: isDark ? '#161823' : '#fff',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { family: "'Inter', sans-serif", size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('pt-BR')}`
                    }
                }
            }
        }
    });
}

// ── Troca de tile layer (claro ↔ escuro) ─────────────────
function trocarTileLayer(escuro) {
    mapa.removeLayer(tileAtual);
    tileAtual = escuro ? tileEscuro : tileClaro;
    tileAtual.addTo(mapa);
}

// ── Alternância de Tema (Claro / Escuro) ─────────────────
const btnTema = document.getElementById('theme-toggle');

btnTema.addEventListener('click', () => {
    const html = document.documentElement;
    const estavaDark = html.getAttribute('data-theme') === 'dark';
    const novoTema = estavaDark ? 'light' : 'dark';

    html.setAttribute('data-theme', novoTema);
    localStorage.setItem('theme', novoTema);
    document.getElementById('theme-icon').className = estavaDark ? 'fas fa-moon' : 'fas fa-sun';

    // Troca o mapa para tile escuro ou claro
    trocarTileLayer(!estavaDark);

    // Re-renderiza marcadores e gráfico com as cores do novo tema
    const dadosFiltrados = obterDadosFiltradosAtual();
    atualizarMapa(dadosFiltrados);
    renderizarGrafico(dadosFiltrados);
});

// ── Limpar Filtros ───────────────────────────────────────
document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
    const anos = [...new Set(dadosOriginais.map(d => d.ano))].filter(v => v !== 'Desconhecido' && v !== 'nan' && v !== 'NÃO INFORMADO').sort();
    if (anos.length > 0) {
        document.getElementById('ano-inicial').value = anos[0];
        document.getElementById('ano-final').value = anos[anos.length - 1];
    } else {
        // Fallback caso não haja anos
        document.getElementById('ano-inicial').value = '';
        document.getElementById('ano-final').value = '';
    }
    document.getElementById('gravidade-filtro').value = 'todos';
    document.getElementById('turno-filtro').value = 'todos';
    document.getElementById('dia-semana-filtro').value = 'todos';
    document.getElementById('tipo-sinistro-filtro').value = 'todos';
    document.getElementById('tipo-veiculo-filtro').value = 'todos';
    document.getElementById('toggle-marcadores').checked = true;
    document.getElementById('toggle-heatmap').checked = false;
    document.getElementById('toggle-hotspots').checked = false;
    
    mostrandoMarcadores = true;
    usandoMapaDeCalor = false;
    mostrandoHotspots = false;
    
    mapa.setView(FRANCA_COORDS, ZOOM_INICIAL);
    aplicarFiltros();
});

// ── Exportar para CSV ────────────────────────────────────
document.getElementById('btn-exportar-csv').addEventListener('click', () => {
    const dados = obterDadosFiltradosAtual();
    if (dados.length === 0) {
        alert("Nenhum dado para exportar.");
        return;
    }

    // Definir as colunas que queremos exportar
    const colunas = [
        'id', 'ano', 'data', 'turno', 'dia_semana', 'tipo_sinistro', 
        'tipo_veiculo', 'gravidade', 'custo_social', 'latitude', 'longitude'
    ];

    // Cabeçalho do CSV
    let csvContent = colunas.join(";") + "\r\n"; // usando ponto e vírgula por causa do Excel pt-BR

    // Linhas de dados
    dados.forEach(row => {
        let values = colunas.map(col => {
            let val = row[col] === null || row[col] === undefined ? "" : String(row[col]);
            // Escapar aspas duplas e envolver TODOS os campos em aspas para evitar quebra por vírgula no Excel
            val = val.replace(/"/g, '""');
            return `"${val}"`;
        });
        csvContent += values.join(";") + "\r\n";
    });

    // Criar download via Blob seguro (sem restrição de tamanho de URI, com BOM UTF-8)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "acidentes_franca_filtrado.csv");
    document.body.appendChild(link); // Requerido no Firefox
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});



// ── Toggle Sidebar ────────────────────────────────────────
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const painelFiltros = document.querySelector('.painel-filtros');
btnToggleSidebar.addEventListener('click', () => {
    painelFiltros.classList.toggle('collapsed');
    
    // Recalcular tamanho do mapa após a transição do CSS (0.3s)
    setTimeout(() => {
        mapa.invalidateSize();
    }, 300);
});