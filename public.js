let publicRecipes = [];
let publicCurrentSearch = '';
let userRecipeIds = new Set();
let isUserLoggedIn = false;

// DOM Elements
const publicGrid = document.getElementById('public-recipe-grid');
const publicSearchInput = document.getElementById('public-search');
const publicViewModal = document.getElementById('public-view-modal');
const publicDetails = document.getElementById('public-recipe-details');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkUserAuth();
    await loadPublicRecipes();
    setupEventListeners();
});

async function checkUserAuth() {
    if (!auth) return;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            isUserLoggedIn = true;
            await loadUserRecipeIds(user.uid);

            const navBtn = document.querySelector('.landing-nav .btn-primary');
            const heroBtn = document.querySelector('.hero-content .btn-primary');
            if (navBtn) {
                navBtn.innerHTML = '<ion-icon name="restaurant-outline"></ion-icon><span>Ir a mi recetario</span>';
                navBtn.href = 'app.html';
            }
            if (heroBtn) {
                heroBtn.innerHTML = '<ion-icon name="restaurant-outline"></ion-icon><span>Ir a mi recetario</span>';
                heroBtn.href = 'app.html';
            }

            // Re-render with auth state
            renderPublicRecipes();
        } else {
            isUserLoggedIn = false;
            userRecipeIds.clear();
            renderPublicRecipes();
        }
    });
}

async function loadUserRecipeIds(userId) {
    if (!db) return;
    try {
        const snapshot = await db.ref(`users/${userId}/recipes`).once('value');
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(r => userRecipeIds.add(r.id));
        }
    } catch (e) {
        console.error('Error loading user recipes:', e);
    }
}

// --- Load Public Recipes ---
async function loadPublicRecipes() {
    if (!db) {
        loadDemoRecipes();
        return;
    }

    try {
        const snapshot = await db.ref('public_recipes').once('value');
        const data = snapshot.val();
        if (data) {
            publicRecipes = Object.values(data).map(r => {
                if (r.category && (!r.tags || r.tags.length === 0)) {
                    r.tags = [r.category];
                }
                if (!r.tags) r.tags = [];
                return r;
            });

            renderPublicRecipes();
        } else {
            loadDemoRecipes();
        }
    } catch (error) {
        console.error('Error cargando recetas públicas:', error);
        if (error.code === 'PERMISSION_DENIED') {
            loadDemoRecipes();
        } else {
            showPublicEmpty('Error de conexión. Verifica tu internet e intenta de nuevo.');
        }
    }
}

async function loadDemoRecipes() {
    try {
        const response = await fetch('./recipes.json');
        if (response.ok) {
            const data = await response.json();
            publicRecipes = data.map(r => {
                r.tags = r.tags || [r.category || 'Otros'];
                r.authorName = 'Gusto Demo';
                return r;
            });

            renderPublicRecipes();
        } else {
            showPublicEmpty('Aún no hay recetas públicas');
        }
    } catch (e) {
        showPublicEmpty('Aún no hay recetas públicas');
    }
}

function showPublicEmpty(message) {
    publicGrid.innerHTML = `
        <div class="no-recipes">
            <ion-icon name="restaurant-outline"></ion-icon>
            <p>${message}</p>
            <a href="app.html" class="btn-primary" style="margin-top: 1rem;">
                <ion-icon name="add"></ion-icon>
                <span>Crear mi primera receta</span>
            </a>
        </div>
    `;
}

// --- Rendering ---
function renderPublicRecipes() {
    const query = publicCurrentSearch.toLowerCase();
    const filtered = publicRecipes.filter(r => {
        if (!query) return true;
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesIngredients = r.ingredients.toLowerCase().includes(query);
        const matchesTags = (r.tags || []).some(t => t.toLowerCase().includes(query));
        return matchesName || matchesIngredients || matchesTags;
    });

    publicGrid.innerHTML = '';
    if (filtered.length === 0) {
        publicGrid.innerHTML = `
            <div class="no-recipes">
                <ion-icon name="sad-outline"></ion-icon>
                <p>No se encontraron recetas</p>
            </div>
        `;
        return;
    }

    filtered.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card public-card';
        const displayTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('');
        const alreadyOwned = isUserLoggedIn && userRecipeIds.has(recipe.id);

        let buttonHtml = '';
        if (isUserLoggedIn) {
            if (alreadyOwned) {
                buttonHtml = `<button class="btn-add-recipe owned" disabled>
                    <ion-icon name="checkmark-circle"></ion-icon>
                    <span>Ya en tu recetario</span>
                </button>`;
            } else {
                buttonHtml = `<button class="btn-add-recipe" onclick="event.stopPropagation(); addToMyRecipes(${recipe.id})">
                    <ion-icon name="add-circle-outline"></ion-icon>
                    <span>A mi recetario</span>
                </button>`;
            }
        }

        card.innerHTML = `
            <div class="recipe-card-img-container">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="recipe-img" alt="${recipe.name}">
                <div class="author-badge">
                    <ion-icon name="person-outline"></ion-icon>
                    <span>${recipe.authorName || 'Anónimo'}</span>
                </div>
                ${recipe.video ? '<div class="video-badge"><ion-icon name="play"></ion-icon></div>' : ''}
            </div>
            <div class="recipe-info">
                <div class="recipe-tags">${displayTags}</div>
                <h3>${recipe.name}</h3>
                <div class="recipe-meta">
                    <span><ion-icon name="time-outline"></ion-icon> ${recipe.time || '--'} min</span>
                    <span><ion-icon name="bar-chart-outline"></ion-icon> ${recipe.difficulty || 'Media'}</span>
                </div>
                ${buttonHtml}
            </div>
        `;
        card.addEventListener('click', () => viewPublicRecipe(recipe.id));
        publicGrid.appendChild(card);
    });
}

// --- View Public Recipe ---
function viewPublicRecipe(id) {
    const recipe = publicRecipes.find(r => r.id === id);
    if (!recipe) return;

    const embedUrl = getYoutubeEmbedUrl(recipe.video);
    const tagsHtml = (recipe.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    const alreadyOwned = isUserLoggedIn && userRecipeIds.has(recipe.id);

    let actionHtml = '';
    if (isUserLoggedIn) {
        if (alreadyOwned) {
            actionHtml = `<span class="detail-owned-badge">
                <ion-icon name="checkmark-circle"></ion-icon> Ya en tu recetario
            </span>`;
        } else {
            actionHtml = `<button class="btn-add-to-recipes" id="detail-add-btn">
                <ion-icon name="add-circle"></ion-icon>
                <span>Agregar a mi recetario</span>
            </button>`;
        }
    } else {
        actionHtml = `<a href="app.html" class="btn-add-to-recipes">
            <ion-icon name="log-in"></ion-icon>
            <span>Inicia sesión para guardarla</span>
        </a>`;
    }

    publicDetails.innerHTML = `
        <div class="detail-body">
            <div class="detail-hero">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" alt="${recipe.name}">
                <div class="detail-hero-overlay"></div>
            </div>
            
            <div class="detail-content">
                <div class="detail-header-info">
                    <div class="recipe-tags" style="margin-bottom: 1rem;">${tagsHtml}</div>
                    <div class="author-info">
                        <ion-icon name="person"></ion-icon>
                        <span>${recipe.authorName || 'Anónimo'}</span>
                    </div>
                    <h1>${recipe.name}</h1>
                    <div class="detail-meta-row">
                        <span><ion-icon name="time-outline"></ion-icon> ${recipe.time || '--'} min</span>
                        <span><ion-icon name="bar-chart-outline"></ion-icon> ${recipe.difficulty || 'Media'}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h3 class="detail-section-title">Ingredientes</h3>
                    <div class="detail-ingredients">${recipe.ingredients.replace(/\n/g, '<br>')}</div>
                </div>

                <div class="detail-section">
                    <h3 class="detail-section-title">Preparación</h3>
                    <div class="detail-steps">${(recipe.steps || recipe.preparation || '').replace(/\n/g, '<br>')}</div>
                </div>

                ${embedUrl ? `
                    <div class="detail-section">
                        <h3 class="detail-section-title">Video Tutorial</h3>
                        <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 20px; border: 1px solid var(--border-color);">
                            <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allowfullscreen></iframe>
                        </div>
                    </div>
                ` : ''}

                <div class="detail-footer">
                    ${actionHtml}
                    <button id="public-share-btn" class="btn-icon circle">
                        <ion-icon name="share-social-outline"></ion-icon>
                    </button>
                </div>
            </div>
        </div>
    `;

    const addBtn = document.getElementById('detail-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addToMyRecipes(recipe.id);
        });
    }
    document.getElementById('public-share-btn').onclick = () => shareRecipe(recipe);
    publicViewModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// --- Add to My Recipes ---
function addToMyRecipes(recipeId) {
    const recipe = publicRecipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const recipeData = JSON.stringify(recipe);
    sessionStorage.setItem('gusto_import_recipe', recipeData);
    window.location.href = 'app.html?import=true';
}

// --- Event Listeners ---
function setupEventListeners() {
    publicSearchInput.addEventListener('input', (e) => {
        publicCurrentSearch = e.target.value;
        renderPublicRecipes();
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            publicViewModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    });
}
