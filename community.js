let allPublicRecipes = [];
let filteredRecipes = [];
let currentPage = 1;
const recipesPerPage = 20;
let userRecipeIds = new Set();
let isUserLoggedIn = false;

// DOM Elements
const publicGrid = document.getElementById('public-recipe-grid');
const publicSearchInput = document.getElementById('public-search');
const publicViewModal = document.getElementById('public-view-modal');
const publicDetails = document.getElementById('public-recipe-details');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkUserAuth();
    await loadAllPublicRecipes();
    setupEventListeners();
});

async function checkUserAuth() {
    if (!auth) return;
    auth.onAuthStateChanged(async (user) => {
        isUserLoggedIn = !!user;
        if (user) await loadUserRecipeIds(user.uid);
        renderCurrentPage();
    });
}

async function loadUserRecipeIds(userId) {
    if (!db) return;
    try {
        const snapshot = await db.ref(`users/${userId}/recipes`).once('value');
        const data = snapshot.val();
        if (data) Object.values(data).forEach(r => userRecipeIds.add(r.id));
    } catch (e) { console.error(e); }
}

async function loadAllPublicRecipes() {
    if (!db) {
        // Fallback a demo si no hay DB
        const response = await fetch('./recipes.json');
        const data = await response.json();
        allPublicRecipes = data;
    } else {
        try {
            const snapshot = await db.ref('public_recipes').once('value');
            const data = snapshot.val();
            if (data) {
                allPublicRecipes = Object.values(data).map(r => {
                    r.tags = r.tags || [r.category || 'Otros'];
                    return r;
                });
            }
        } catch (error) { console.error(error); }
    }
    filteredRecipes = [...allPublicRecipes];
    renderCurrentPage();
}

function renderCurrentPage() {
    const startIndex = (currentPage - 1) * recipesPerPage;
    const endIndex = startIndex + recipesPerPage;
    const pageRecipes = filteredRecipes.slice(startIndex, endIndex);

    publicGrid.innerHTML = '';
    
    if (pageRecipes.length === 0) {
        publicGrid.innerHTML = '<div class="no-recipes"><p>No se encontraron recetas.</p></div>';
    } else {
        pageRecipes.forEach((recipe, index) => {
            // Anuncios desactivados temporalmente por solicitud del usuario
            /* if (index > 0 && index % 5 === 0) {
                injectInFeedAd(index);
            } */
            renderRecipeCard(recipe);
        });
    }

    updatePaginationControls();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card public-card';
    const displayTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('');
    const alreadyOwned = isUserLoggedIn && userRecipeIds.has(recipe.id);
    
    // Solo mostrar el primer nombre del autor
    const firstName = recipe.authorName ? recipe.authorName.split(' ')[0] : 'Anónimo';

    let buttonHtml = '';
    if (isUserLoggedIn) {
        buttonHtml = alreadyOwned 
            ? `<button class="btn-add-recipe owned" disabled><span class="material-icons">check_circle</span><span>En mi recetario</span></button>`
            : `<button class="btn-add-recipe" onclick="event.stopPropagation(); addToMyRecipes(${recipe.id})"><span class="material-icons">add_circle_outline</span><span>A mi recetario</span></button>`;
    }

    card.innerHTML = `
        <div class="recipe-card-img-container">
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="recipe-img" alt="${recipe.name}">
            <div class="author-badge"><span class="material-icons">person_outline</span><span>${firstName}</span></div>
        </div>
        <div class="recipe-info">
            <div class="recipe-tags">${displayTags}</div>
            <h3>${recipe.name}</h3>
            <div class="recipe-meta">
                <span><span class="material-icons">schedule</span> ${recipe.time || '--'} min</span>
                <span><span class="material-icons">bar_chart</span> ${recipe.difficulty || 'Media'}</span>
            </div>
            ${buttonHtml}
        </div>
    `;
    card.addEventListener('click', () => viewPublicRecipe(recipe.id));
    publicGrid.appendChild(card);
}

function injectInFeedAd(index) {
    const adCard = document.createElement('div');
    adCard.className = 'recipe-card ad-card';
    adCard.innerHTML = `
        <span class="ad-tag">Publicidad</span>
        <div id="adsense-community-${index}" style="width:100%;">
            <p style="opacity: 0.5; font-size: 0.8rem;">Anuncio de AdSense</p>
        </div>
    `;
    publicGrid.appendChild(adCard);
}

function updatePaginationControls() {
    const totalPages = Math.ceil(filteredRecipes.length / recipesPerPage);
    pageInfo.innerText = `Página ${currentPage} de ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// --- Event Listeners ---
function setupEventListeners() {
    publicSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filteredRecipes = allPublicRecipes.filter(r => 
            r.name.toLowerCase().includes(query) || 
            (r.ingredients && r.ingredients.toLowerCase().includes(query)) ||
            (r.tags && r.tags.some(t => t.toLowerCase().includes(query)))
        );
        currentPage = 1;
        renderCurrentPage();
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredRecipes.length / recipesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
        }
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            publicViewModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    });
}

// Funciones compartidas (View, AddToMyRecipes) igual que antes pero adaptadas si es necesario
function viewPublicRecipe(id) {
    const recipe = allPublicRecipes.find(r => r.id === id);
    if (!recipe) return;

    const embedUrl = getYoutubeEmbedUrl(recipe.video);
    const tagsHtml = (recipe.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    const alreadyOwned = isUserLoggedIn && userRecipeIds.has(recipe.id);
    
    // Solo el primer nombre del autor para el detalle también
    const firstName = recipe.authorName ? recipe.authorName.split(' ')[0] : 'Anónimo';

    let actionHtml = isUserLoggedIn 
        ? (alreadyOwned ? `<span class="detail-owned-badge"><span class="material-icons">check_circle</span> Ya en tu recetario</span>` 
                        : `<button class="btn-add-to-recipes" id="detail-add-btn"><span class="material-icons">add_circle</span><span>Agregar</span></button>`)
        : `<a href="app.html" class="btn-add-to-recipes"><span class="material-icons">login</span><span>Inicia sesión para guardar</span></a>`;

    publicDetails.innerHTML = `
        <div class="detail-body">
            <div class="detail-hero">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" alt="${recipe.name}">
                <div class="detail-hero-overlay"></div>
            </div>
            <div class="detail-content">
                <div class="detail-header-info">
                    <div class="recipe-tags" style="margin-bottom: 1rem;">${tagsHtml}</div>
                    <div class="author-info"><span class="material-icons">person</span><span>${firstName}</span></div>
                    <h1>${recipe.name}</h1>
                    <div class="detail-meta-row">
                        <span><span class="material-icons">schedule</span> ${recipe.time || '--'} min</span>
                        <span><span class="material-icons">bar_chart</span> ${recipe.difficulty || 'Media'}</span>
                    </div>
                </div>
                <div class="detail-section">
                    <h3 class="detail-section-title">Ingredientes</h3>
                    <div class="detail-ingredients">${(recipe.ingredients || '').split('\n').filter(l => l.trim()).map(l => `<div class="ingredient-item">${renderIngredientLine(l)}</div>`).join('')}</div>
                </div>
                <div class="detail-section">
                    <h3 class="detail-section-title">Preparación</h3>
                    <div class="detail-steps">${(recipe.steps || recipe.preparation || '').replace(/\n/g, '<br>')}</div>
                </div>
                ${embedUrl ? `<div class="detail-section"><h3 class="detail-section-title">Video Tutorial</h3><div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 20px;"><iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allowfullscreen></iframe></div></div>` : ''}
                <div class="detail-footer">
                    ${actionHtml}
                    <button id="public-share-btn" class="btn-icon circle"><span class="material-icons">share</span></button>
                </div>
            </div>
        </div>
    `;

    const addBtn = document.getElementById('detail-add-btn');
    if (addBtn) addBtn.onclick = () => addToMyRecipes(recipe.id);
    document.getElementById('public-share-btn').onclick = () => shareRecipe(recipe);
    publicViewModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function addToMyRecipes(recipeId) {
    const recipe = allPublicRecipes.find(r => r.id === recipeId);
    if (!recipe) return;
    sessionStorage.setItem('gusto_import_recipe', JSON.stringify(recipe));
    window.location.href = 'app.html?import=true';
}
