let currentSlide = 0;
const slides = document.querySelectorAll(".slide");

function changeSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    document.querySelector(".slides").style.transform = `translateX(-${currentSlide * 100}%)`;
}

setInterval(changeSlide, 5000);

document.addEventListener('DOMContentLoaded', () => {
  const BLOG_URL = 'https://ceeplourdescarvalho.blogspot.com/'; // <--- troque aqui pela URL do seu blog
  const MAX_POSTS = 4;
  initBloggerNews(BLOG_URL, MAX_POSTS);
});

/* ====== Função principal ====== */
async function initBloggerNews(blogUrl, maxPosts = 4) {
  try {
    const entries = await fetchBloggerPosts(blogUrl, maxPosts);
    renderNews(entries);
  } catch (err) {
    console.error('Erro ao obter posts do Blogger:', err);
  }
}

/* ====== Fetch com fallback JSONP (caso CORS bloqueie) ====== */
function fetchBloggerPosts(blogUrl, maxResults) {
  const feedBase = `${blogUrl.replace(/\/$/, '')}/feeds/posts/default`;
  const feedUrl = `${feedBase}?alt=json&max-results=${maxResults}`;

  // tenta fetch normal
  return fetch(feedUrl)
    .then(resp => {
      if (!resp.ok) throw new Error('fetch failed');
      return resp.json();
    })
    .then(data => parseEntries(data))
    .catch(_ => {
      // fallback JSONP
      return new Promise((resolve, reject) => {
        const callbackName = 'cb_' + Date.now();
        window[callbackName] = function(data) {
          resolve(parseEntries(data));
          delete window[callbackName];
          script.remove();
        };
        const script = document.createElement('script');
        // json-in-script + callback para JSONP
        script.src = `${feedUrl.replace('&alt=json', '')}&alt=json-in-script&callback=${callbackName}`;
        script.onerror = () => {
          delete window[callbackName];
          script.remove();
          reject(new Error('JSONP load failed'));
        };
        document.body.appendChild(script);
      });
    });
}

/* ====== Parse do JSON do Blogger ====== */
function parseEntries(data) {
  const items = (data && data.feed && data.feed.entry) ? data.feed.entry : [];
  return items.map(entry => {
    const title = entry.title && entry.title.$t ? entry.title.$t : '';
    const published = entry.published ? entry.published.$t : (entry.updated ? entry.updated.$t : '');
    const author = (entry.author && entry.author[0] && entry.author[0].name && entry.author[0].name.$t) ? entry.author[0].name.$t : '';
    const content = entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '');
    // link principal (rel="alternate")
    let link = '#';
    if (entry.link && Array.isArray(entry.link)) {
      const alt = entry.link.find(l => l.rel === 'alternate');
      if (alt) link = alt.href;
    }
    // thumbnail: prefere media$thumbnail, senão pega a primeira <img> no content
    let thumbnail = '';
    if (entry.media$thumbnail && entry.media$thumbnail.url) {
      thumbnail = entry.media$thumbnail.url;
      // opcional: substituir tamanho 's72' por 's800' para maior resolução, se existir:
      thumbnail = thumbnail.replace(/\/s72(-c)?\//, '/s800/');
    } else {
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) thumbnail = imgMatch[1].replace(/\/s72(-c)?\//, '/s800/');
    }
    return { title, published, author, content, thumbnail, link };
  });
}

/* ====== Renderiza no DOM ====== */
function renderNews(entries) {
  const container = document.getElementById('noticias-container');
  if (!container) return;

  // garante pelo menos um array
  if (!entries || entries.length === 0) {
    container.innerHTML = '<p>Nenhuma notícia encontrada.</p>';
    return;
  }

  // principal (primeiro)
  const main = entries[0];
  const mainHTML = document.createElement('div');
  mainHTML.className = 'noticia-principal';
  mainHTML.innerHTML = `
    <a href="${escapeHtml(main.link)}" target="_blank" class="noticia-principal-link">
      <div class="noticia-img-wrap">
        <img src="${main.thumbnail || 'img/noticia-default.jpg'}" alt="${escapeHtml(main.title)}">
      </div>
      <h3>${escapeHtml(main.title)}</h3>
    </a>
    <p>${excerpt(stripHtml(main.content), 320)}</p>
    <div class="meta">Publicado por ${escapeHtml(main.author || 'Equipe')} • ${formatDate(main.published)}</div>
  `;

  // laterais (2..n)
  const laterais = document.createElement('div');
  laterais.className = 'noticias-laterais';

  for (let i = 1; i < Math.min(entries.length, 6); i++) {
    const e = entries[i];
    const a = document.createElement('a');
    a.className = 'noticia-secundaria';
    a.href = e.link || '#';
    a.target = '_blank';
    a.innerHTML = `
      <div class="sec-thumb"><img src="${e.thumbnail || 'img/noticia-thumb.jpg'}" alt="${escapeHtml(e.title)}"></div>
      <div class="sec-info">
        <h4>${escapeHtml(e.title)}</h4>
        <div class="meta-small">${formatDate(e.published)} • ${escapeHtml(e.author || 'Equipe')}</div>
      </div>
    `;
    laterais.appendChild(a);
  }

  // coloca no container usando grid (um ao lado do outro)
  container.innerHTML = ''; // limpa
  container.appendChild(mainHTML);
  container.appendChild(laterais);
}

/* ====== Helpers ====== */
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
function excerpt(text, limit = 200) {
  if (!text) return '';
  text = text.trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, '') + '…';
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, function (m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

/* menu notícias */
const blogUrl = "https://ceeplourdescarvalho.blogspot.com/"; // troque pelo seu
const maxResults = 10; // 10 por página
let startIndex = 1; // índice inicial
let paginaAtual = 1;

async function carregarNoticias() {
  const url = `${blogUrl}/feeds/posts/default?alt=json&max-results=${maxResults}&start-index=${startIndex}`;
  
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Erro ao carregar notícias");
    const data = await resp.json();
    
    const container = document.getElementById("lista-noticias");
    container.innerHTML = "";

    const entries = data.feed.entry || [];
    entries.forEach(post => {
      const title = post.title.$t;
      const link = post.link.find(l => l.rel === "alternate").href;
      const published = new Date(post.published.$t).toLocaleDateString('pt-BR');
      const content = post.content ? post.content.$t : post.summary.$t;
      
      let thumbnail = "";
      if (post.media$thumbnail) {
        thumbnail = post.media$thumbnail.url.replace(/\/s72(-c)?\//, "/s400/");
      } else {
        const match = content.match(/<img[^>]+src="([^">]+)"/);
        if (match) thumbnail = match[1];
      }
      
      const resumo = content.replace(/<[^>]*>/g, "").substring(0, 150) + "...";
      
      const item = document.createElement("div");
      item.className = "noticia-item";
      item.innerHTML = `
        <a href="${link}" target="_blank">
          <img src="${thumbnail || 'img/noticia-default.jpg'}" alt="${title}">
        </a>
        <div class="noticia-conteudo">
          <h3><a href="${link}" target="_blank">${title}</a></h3>
          <div class="noticia-meta">${published}</div>
          <p>${resumo}</p>
        </div>
      `;
      
      container.appendChild(item);
    });

    document.getElementById("pagina-atual").textContent = paginaAtual;
    document.getElementById("btn-anterior").disabled = paginaAtual === 1;
    document.getElementById("btn-proxima").disabled = entries.length < maxResults;

  } catch (err) {
    console.error(err);
    document.getElementById("lista-noticias").innerHTML = "<p>Erro ao carregar notícias.</p>";
  }
}

document.getElementById("btn-anterior").addEventListener("click", () => {
  if (paginaAtual > 1) {
    paginaAtual--;
    startIndex = (paginaAtual - 1) * maxResults + 1;
    carregarNoticias();
  }
});

document.getElementById("btn-proxima").addEventListener("click", () => {
  paginaAtual++;
  startIndex = (paginaAtual - 1) * maxResults + 1;
  carregarNoticias();
});

carregarNoticias();
