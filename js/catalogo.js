const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8044/api/v1'
  : 'https://sigashop.omisoltec.mx/api/v1';
const MEDIA_BASE = API_BASE.replace(/\/api\/v1\/?$/, '');
const WHATSAPP = '5215634861468';
const state = { category: '', search: '', page: 0, size: 24, pages: 0, hasMore: true, loading: false, products: [], categories: [], activeProduct: null };

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
  $('#search').addEventListener('input', debounce(() => { state.search = $('#search').value.trim(); loadProducts(true); }, 300));
  document.querySelectorAll('[data-close-modal]').forEach(element => element.addEventListener('click', closeModal));
  try {
    state.categories = await request('/catalogo/categorias');
    renderCategories();
    setupInfiniteScroll();
    await loadProducts(true);
  } catch (error) { showStatus(error.message, true); }
  window.addEventListener('hashchange', handleHash);
  handleHash();
}

async function loadProducts(reset = true) {
  if (state.loading || (!reset && !state.hasMore)) return;
  if (reset) {
    state.page = 0;
    state.pages = 0;
    state.hasMore = true;
    state.products = [];
    $('#products').innerHTML = '';
    showStatus('Cargando productos...');
  }
  state.loading = true;
  const params = new URLSearchParams({ page: state.page, size: state.size, sort: 'nombre,asc' });
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('idCategoria', state.category);
  try {
    const result = await request('/catalogo/productos?' + params);
    const products = result.content || [];
    state.products = reset ? products : state.products.concat(products);
    state.pages = result.totalPages || 0;
    state.hasMore = !result.last && products.length > 0;
    state.page = (result.number ?? state.page) + 1;
    renderProducts();
    renderPagination();
  } catch (error) { showStatus(error.message, true); }
  finally { state.loading = false; }
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
    loadProducts(true);
  });
}

function renderProducts() {
  const container = $('#products');
  if (!state.products.length) { container.innerHTML = ''; showStatus('No encontramos productos con esos criterios.'); return; }
  $('#catalog-status').textContent = '';
  container.innerHTML = state.products.map(product => {
    const image = product.imagenPrincipalUrl ? `<img src="${esc(mediaUrl(product.imagenPrincipalUrl))}" alt="${esc(product.nombre)}" loading="lazy">` : '<span class="placeholder">✦</span>';
   return `<article class="product-card" data-product-card="${product.idProducto}" tabindex="0" role="button" aria-label="Ver ${esc(product.nombre)}"><div class="product-image">${image}</div><div class="product-info"><div class="product-category">${esc(product.categoriaNombre || 'Producto')}</div><h3 class="product-name">${esc(product.nombre)}</h3><div class="product-bottom"><span class="price">${money(product.precio)}</span><a class="button whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener" data-whatsapp>Comprar por WhatsApp ↗</a></div></div></article>`;
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
  $('#pagination').innerHTML = '';
}

function setupInfiniteScroll() {
  const sentinel = $('#catalog-sentinel');
  if (!sentinel || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadProducts(false);
  }, { rootMargin: '500px 0px' });
  observer.observe(sentinel);
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
  const first = media.find(item => item.esPrincipal && item.tipo === 'IMAGEN') || images[0] || media[0];
  let activeIndex = Math.max(0, media.findIndex(item => item.idMultimedia === first?.idMultimedia));
  const main = first ? renderMediaPreview(first, product.nombre) : '<span class="placeholder">✦</span>';
  const thumbs = media.map((item, index) => `<button class="detail-thumb ${index === activeIndex ? 'active' : ''}" data-media-index="${index}" aria-label="Abrir archivo ${index + 1}">${renderMediaThumb(item)}</button>`).join('');
  const arrows = media.length > 1 ? '<button class="detail-arrow detail-arrow-prev" type="button" aria-label="Archivo anterior">‹</button><button class="detail-arrow detail-arrow-next" type="button" aria-label="Siguiente archivo">›</button>' : '';
  $('#product-detail').innerHTML = `<div class="detail-gallery"><div class="detail-thumbs">${thumbs}</div><div class="detail-main-media">${arrows}<div id="detail-media-content">${main}</div></div></div><div class="detail-copy"><div class="product-category">${esc(product.categoriaNombre || 'Producto')}</div><h2 id="modal-title">${esc(product.nombre)}</h2><p>${esc(product.descripcion || 'Solicita más información sobre este producto por WhatsApp.')}</p><div class="detail-price">${money(product.precio)}</div><a class="button whatsapp" href="${whatsappUrl(product)}" target="_blank" rel="noopener">Comprar ahora por WhatsApp ↗</a></div>`;
  const selectMedia = (nextIndex, direction) => {
    if (!media.length) return;
    activeIndex = (nextIndex + media.length) % media.length;
    const selected = media[activeIndex];
    const content = $('#detail-media-content');
    content.className = 'media-changing ' + (direction === 'prev' ? 'media-enter-prev' : 'media-enter-next');
    content.innerHTML = renderMediaPreview(selected, product.nombre);
    document.querySelectorAll('.detail-thumb').forEach((item, index) => item.classList.toggle('active', index === activeIndex));
  };
  $('#product-detail').querySelectorAll('[data-media-index]').forEach(button => button.addEventListener('click', () => selectMedia(Number(button.dataset.mediaIndex), Number(button.dataset.mediaIndex) < activeIndex ? 'prev' : 'next')));
  $('#product-detail').querySelector('.detail-arrow-prev')?.addEventListener('click', () => selectMedia(activeIndex - 1, 'prev'));
  $('#product-detail').querySelector('.detail-arrow-next')?.addEventListener('click', () => selectMedia(activeIndex + 1, 'next'));
}

function renderMediaPreview(media, productName) {
  const url = esc(mediaUrl(media.url));
  if (media.tipo === 'VIDEO') return `<video src="${url}" controls playsinline preload="metadata"></video>`;
  if (media.tipo === 'DOCUMENTO') return `<div class="detail-document"><iframe src="${url}" title="${esc(media.nombreArchivo || 'Documento PDF')}"></iframe><a href="${url}" target="_blank" rel="noopener">Abrir PDF en otra pestaña ↗</a></div>`;
  return `<img src="${url}" alt="${esc(productName)}">`;
}

function renderMediaThumb(media) {
  const url = esc(mediaUrl(media.url));
  if (media.tipo === 'VIDEO') return '<span class="media-thumb-icon">▶</span>';
  if (media.tipo === 'DOCUMENTO') return '<span class="media-thumb-icon pdf">PDF</span>';
  return `<img src="${url}" alt="">`;
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
