// Library panel: GIPHY gifs, picsum images, local uploads.
const GIPHY_KEY = 'pCjkqdZQCp6TVtFBI1hJia1LyQWy1LlE';
const GIPHY_RATING = 'pg-13';
const BATCH = 24;

export function createLibrary({ onPick, onStamp, setStatus }) {
  const grid = document.getElementById('lib-grid');
  const tabs = document.getElementById('lib-tabs');
  const searchForm = document.getElementById('lib-search-form');
  const searchInput = document.getElementById('lib-search');
  const moreBtn = document.getElementById('lib-more');
  const uploadInput = document.getElementById('upload-file');

  const state = { tab: 'gifs', query: '', offset: 0, picked: null };
  const uploads = []; // {url, thumb, kind}

  async function fetchGiphy() {
    const base = state.query
      ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(state.query)}`
      : 'https://api.giphy.com/v1/gifs/trending?';
    const url = `${base}&api_key=${GIPHY_KEY}&limit=${BATCH}&offset=${state.offset}&rating=${GIPHY_RATING}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`giphy ${res.status}`);
    const json = await res.json();
    return json.data
      .map((g) => ({
        kind: 'gif',
        url: g.images?.fixed_height?.url ?? g.images?.original?.url,
        thumb: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url
      }))
      .filter((e) => e.url);
  }

  function fetchPicsum() {
    // no API needed — seeded random photos, CORS-enabled
    return Array.from({ length: BATCH }, () => {
      const seed = Math.random().toString(36).slice(2, 10);
      return {
        kind: 'img',
        url: `https://picsum.photos/seed/${seed}/600/450`,
        thumb: `https://picsum.photos/seed/${seed}/150/112`
      };
    });
  }

  function addCell(entry) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'lib-cell';
    cell.setAttribute('aria-pressed', 'false');
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = entry.thumb ?? entry.url;
    img.alt = '';
    // span, not button — cell is already a button and buttons can't nest;
    // keyboard path for stamping is the stamp tool (S)
    const add = document.createElement('span');
    add.className = 'lib-add';
    add.setAttribute('aria-hidden', 'true');
    add.innerHTML = '<span>+</span>';
    add.title = 'add to canvas';
    cell.append(img, add);
    cell.addEventListener('click', (e) => {
      if (add.contains(e.target)) {
        onStamp(entry);
        return;
      }
      const wasPicked = cell.classList.contains('picked');
      const prev = grid.querySelector('.picked');
      prev?.classList.remove('picked');
      prev?.setAttribute('aria-pressed', 'false');
      if (wasPicked) {
        state.picked = null;
        onPick(null); // unpick — color brushes paint plain color again
        return;
      }
      cell.classList.add('picked');
      cell.setAttribute('aria-pressed', 'true');
      state.picked = entry;
      onPick(entry);
    });
    grid.appendChild(cell);
  }

  function showSkeletons(n) {
    grid.setAttribute('aria-busy', 'true');
    for (let i = 0; i < n; i++) {
      const skel = document.createElement('div');
      skel.className = 'lib-skel';
      skel.setAttribute('aria-hidden', 'true');
      grid.appendChild(skel);
    }
  }

  function clearSkeletons() {
    grid.removeAttribute('aria-busy');
    grid.querySelectorAll('.lib-skel').forEach((el) => el.remove());
  }

  function showEmpty(text) {
    const p = document.createElement('p');
    p.className = 'lib-empty';
    p.textContent = text;
    grid.appendChild(p);
  }

  async function loadMore(reset = false) {
    if (reset) {
      grid.innerHTML = '';
      state.offset = 0;
    }
    moreBtn.disabled = true;
    if (state.tab === 'gifs') showSkeletons(reset ? BATCH : 6);
    try {
      let entries;
      if (state.tab === 'gifs') entries = await fetchGiphy();
      else if (state.tab === 'images') entries = fetchPicsum();
      else entries = reset ? uploads : [];
      clearSkeletons();
      entries.forEach(addCell);
      state.offset += BATCH;
      if (reset && !entries.length) {
        if (state.tab === 'uploads') showEmpty('No uploads yet — drop an image or video anywhere.');
        else if (state.query) showEmpty(`Nothing for “${state.query}” — try another word.`);
      }
    } catch (err) {
      clearSkeletons();
      showEmpty(`Couldn’t reach giphy (${err.message ?? err}) — check your connection and try more.`);
    }
    moreBtn.disabled = false;
  }

  function addUploadFiles(files) {
    for (const file of files) {
      if (!/^(image|video)\//.test(file.type)) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const entry = {
          kind: file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'img',
          url: reader.result, // ponytail: dataURL uploads, localStorage-save caps ~5MB
          thumb: reader.result
        };
        uploads.push(entry);
        if (state.tab === 'uploads') addCell(entry);
      };
      reader.readAsDataURL(file);
    }
  }

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    tabs.querySelector('.active')?.classList.remove('active');
    btn.classList.add('active');
    state.tab = btn.dataset.tab;
    searchForm.style.display = state.tab === 'gifs' ? '' : 'none';
    moreBtn.textContent = state.tab === 'uploads' ? 'upload files' : 'more';
    loadMore(true);
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.query = searchInput.value.trim();
    loadMore(true);
  });

  moreBtn.addEventListener('click', () => {
    if (state.tab === 'uploads') uploadInput.click();
    else loadMore();
  });

  uploadInput.addEventListener('change', () => {
    addUploadFiles(uploadInput.files);
    uploadInput.value = '';
  });

  // drag & drop anywhere
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addUploadFiles(e.dataTransfer.files);
  });

  loadMore(true);
  return { getPicked: () => state.picked };
}
