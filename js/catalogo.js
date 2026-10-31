const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8044/api/v1'
  : 'https://sigashop.omisoltec.mx/api/v1';
const MEDIA_BASE = API_BASE.replace(/\/api\/v1\/?$/, '');
const WHATSAPP = '5215634861468';
const state = { category: '', search: '', page: 0, size: 24, pages: 0, products: [], categories: [], activeProduct: null };

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const mediaUrl = url => url ? MEDIA_BASE + url : '';
const money = value => value == null ? 'Consultar precio' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const whatsappUrl = product => 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola, me interesa este producto, ' + product.nombre);

async function request(path) {
  const response = await fetch(API_BASE + path, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('No se pudo cargar el catálogo');
  return response.json();
}

async function init() {
  $('#search').addEventListener('input', debounce(() => { state.search = $('#search').value.trim(); state.page = 0; loadProducts(); }, 300));
  document.querySelectorAll('[data-close-modal]').forEach(element => element.addEventListener('click', closeModal));
  try {
    state.categories = await request('/catalogo/categorias');
    renderCategories();
    await loadProducts();
  } catch (error) { showStatus(error.message, true); }
  window.addEventListener('hashchange', handleHash);
  handleHash();
}

async function loadProducts() {
  showStatus('Cargando productos...');
  const params = new URLSearchParams({ page: state.page, size: state.size, sort: 'nombre,asc' });
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('idCategoria', state.category);
  try {
    const result = await request('/catalogo/productos?' + params);
    state.products = result.content || [];
    state.pages = result.totalPages || 0;
    renderProducts();
    renderPagination();
  } catch (error) { showStatus(error.message, true); }
}

function renderCategories() {
  $('#categories').innerHTML = '<button class="category-button active" data-category="">Todos</button>' + state.categories.map(category =>
    `<button class="category-button" data-category="${category.idCategoria}">${esc(category.nombre)}</button>`).join('');
  $('#categories').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    state.page = 0;
    document.querySelectorAll('.category-button').forEach(item => item.classList.toggle('active', item === button));
    loadProducts();
  });
}

function renderProducts() {
  const container = $('#products');
  if (!state.products.length) { container.innerHTML = ''; showStatus('No encontramos productos con esos criterios.'); return; }
  $('#catalog-status').textContent = '';
  container.innerHTML = state.products.map(product => {
    const image = product.imagenPrincipalUrl ? `<img src="${esc(mediaUrl(product.imagenPrincipalUrl))}" alt="${esc(product.nombre)}" loading="lazy">` : '<span class="placeholder">✦</span>';
    return `<article class="product-card" data-product-card="${product.idProducto}" tabindex="0" role="button" aria-label="Ver ${esc(product.nombre)}"><div class="product-image">${image}${product.multimedia?.length ? `<span class="media-count">${product.multimedia.length} archivo${product.multimedia.length === 1 ? '' : 's'}</span>` : ''}</div><div class="product-info"><div class="product-category">${esc(product.categoriaNombre || 'Producto')}</div><h3 class="product-name">${esc(product.nombre)}</h3><p class="product-description">${esc(product.descripcion || 'Conoce más detalles de este producto.')}</p><div class="product-bottom"><span class="price">${money(product.precio)}</span><a class="button whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener" data-whatsapp>Comprar por WhatsApp ↗</a></div></div></article>`;
  }).join('');
  container.querySelectorAll('[data-product-card]').forEach(card => {
    const open = () => openProduct(card.dataset.productCard);
    card.addEventListener('click', event => {
      if (event.target.closest('[data-whatsapp]')) return;
      open();
    });
    card.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('[data-whatsapp]')) {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderPagination() {
  const container = $('#pagination');
  if (state.pages <= 1) { container.innerHTML = ''; return; }
  container.innerHTML = Array.from({ length: state.pages }, (_, index) => `<button class="page-button ${index === state.page ? 'active' : ''}" data-page="${index}">${index + 1}</button>`).join('');
  container.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { state.page = Number(button.dataset.page); loadProducts(); window.scrollTo({ top: $('#catalogo').offsetTop - 80, behavior: 'smooth' }); }));
}

async function openProduct(id) {
  const detail = $('#product-detail');
  $('#product-modal').classList.remove('hidden');
  detail.innerHTML = '<div class="status-message">Cargando producto...</div>';
  try { state.activeProduct = await request('/catalogo/productos/' + id); renderDetail(); } catch (error) { detail.innerHTML = `<div class="status-message error">${esc(error.message)}</div>`; }
}

function renderDetail() {
  const product = state.activeProduct;
  const media = product.multimedia || [];
  const images = media.filter(item => item.tipo === 'IMAGEN');
  const first = images[0];
  const main = first ? `<img src="${esc(mediaUrl(first.url))}" alt="${esc(product.nombre)}">` : '<span class="placeholder">✦</span>';
  const thumbs = images.map((item, index) => `<button class="detail-thumb ${index === 0 ? 'active' : ''}" data-media-url="${esc(item.url)}"><img src="${esc(mediaUrl(item.url))}" alt=""></button>`).join('');
  $('#product-detail').innerHTML = `<div class="detail-gallery"><div id="detail-main-media" class="detail-main-media">${main}</div><div class="detail-thumbs">${thumbs}</div></div><div class="detail-copy"><div class="product-category">${esc(product.categoriaNombre || 'Producto')}</div><h2 id="modal-title">${esc(product.nombre)}</h2><p>${esc(product.descripcion || 'Solicita más información sobre este producto por WhatsApp.')}</p><div class="detail-price">${money(product.precio)}</div><a class="button whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener">Comprar ahora por WhatsApp ↗</a></div>`;
  $('#product-detail').querySelectorAll('[data-media-url]').forEach(button => button.addEventListener('click', () => { $('#detail-main-media').innerHTML = `<img src="${esc(mediaUrl(button.dataset.mediaUrl))}" alt="${esc(product.nombre)}">`; document.querySelectorAll('.detail-thumb').forEach(item => item.classList.toggle('active', item === button)); }));
}

function closeModal() { $('#product-modal').classList.add('hidden'); window.location.hash = ''; }
function handleHash() { const id = window.location.hash.match(/^#producto-(\d+)$/); if (id) openProduct(id[1]); }
function showStatus(message, error = false) { const status = $('#catalog-status'); status.textContent = message; status.classList.toggle('error', error); }
function debounce(callback, delay) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), delay); }; }

function startCatalogo() {
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startCatalogo, { once: true });
} else {
  startCatalogo();
}
