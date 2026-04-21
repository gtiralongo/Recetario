// SW Cleanup / Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) registration.unregister();
    });
}

// Recipe Data Management
let recipes = [];
let userTags = ['Carnes', 'Pastas', 'Ensaladas', 'Postres', 'Otros']; // Default tags
let currentTag = 'all';
let currentSearch = '';
let editingRecipeId = null;
let currentView = 'home';
let isLoggedIn = false;
let randomCarouselInterval = null;

// --- Firebase Configuration (FILL THIS WITH YOUR DATA) ---
const firebaseConfig = {
    apiKey: "AIzaSyDJLupBIAcg3ak72yzTCojgfXUiVJb5-tA",
    authDomain: "gusto---recetario.firebaseapp.com",
    databaseURL: "https://gusto---recetario-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gusto---recetario",
    storageBucket: "gusto---recetario.firebasestorage.app",
    messagingSenderId: "966929495219",
    appId: "1:966929495219:web:785adead1c98edb28cacc6",
    measurementId: "G-FQMS8GMCGL"
};

// Initialize Firebase
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database ? firebase.database() : null;
// --- Tags Dropdown Management ---
function initTagsDropdown() {
    renderTagDropdowns();
}

function renderTagDropdowns() {
    tagOptionsLists.forEach(list => {
        if (!list) return;
        let html = `<li onclick="filterByTag('all')">${list.id.includes('mobile') ? 'Todas' : 'Todas las Tags'}</li>`;
        userTags.forEach(tag => {
            html += `<li onclick="filterByTag('${tag}')">${tag}</li>`;
        });
        list.innerHTML = html;
    });
}

function filterByTag(tag) {
    currentTag = tag;
    tagLabels.forEach(label => {
        if (label) label.textContent = tag === 'all' ? 'Todas las Tags' : tag;
    });
    renderRecipes();
}
const auth = firebase.auth ? firebase.auth() : null;

// DOM Elements
const recipeGrid = document.getElementById('recipe-grid');
const recipeCountText = document.getElementById('recipe-count');
const searchInput = document.getElementById('recipe-search');
const navItems = document.querySelectorAll('.nav-item');
const categoryTitle = document.getElementById('main-grid-title');
const randomContainer = document.getElementById('random-recipes-container');
const randomTrack = document.getElementById('random-recipes-track');
const imageInput = document.getElementById('recipe-image');
const imagePreview = document.getElementById('image-preview');
const imagePlaceholder = document.getElementById('image-placeholder');
const searchGoogleBtn = document.getElementById('search-google-btn');

// Advanced Sections
const plannerView = document.getElementById('planner-view');
const shoppingView = document.getElementById('shopping-view');
const recipeGridContainer = document.querySelector('.recipe-grid-container');
const plannerGrid = document.getElementById('planner-grid');
const shoppingContent = document.getElementById('shopping-list-content');

// Planner Modal
const plannerModal = document.getElementById('planner-modal');
const plannerDayName = document.getElementById('planner-day-name');
const plannerOptions = document.getElementById('planner-options');
let activePlannerDay = '';

// Cooking Mode
const cookOverlay = document.getElementById('cook-overlay');
const exitCookBtn = document.getElementById('exit-cook-btn');
const cookModeBtn = document.getElementById('cook-mode-btn');
const shareRecipeBtn = document.getElementById('share-recipe-btn');
const editCurrentBtn = document.getElementById('edit-current-btn');
const favoriteCurrentBtn = document.getElementById('favorite-current-btn');

// Modals
const recipeModal = document.getElementById('recipe-modal');
const viewModal = document.getElementById('view-modal');
const recipeForm = document.getElementById('recipe-form');
const closeBtns = document.querySelectorAll('.close-modal');
const importModal = document.getElementById('import-modal');
const processJsonBtn = document.getElementById('process-json-btn');
const jsonInput = document.getElementById('json-input');
const importError = document.getElementById('import-error');

// Tag Dropdowns (Desktop & Mobile)
const tagContainers = [document.getElementById('tag-dropdown-desktop'), document.getElementById('tag-dropdown-mobile')];
const tagOptionsLists = [document.getElementById('tag-options-desktop'), document.getElementById('tag-options-mobile')];
const tagLabels = [document.getElementById('current-tag-label-desktop')]; // Only desktop has a label span

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <ion-icon name="${type === 'success' ? 'checkmark-circle' : 'alert-circle'}"></ion-icon>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Initialization ---

let plannerData = JSON.parse(localStorage.getItem('gusto_planner')) || {};

async function init() {
    await loadData();
    setupEventListeners();
    switchView('home');
    renderRandomRecipes();
}

async function loadData() {
    if (!db || !auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    // Load Tags
    try {
        const tagSnapshot = await db.ref(`users/${userId}/tags`).once('value');
        const tagData = tagSnapshot.val();
        if (tagData) {
            userTags = tagData;
        } else {
            // Seed default tags
            db.ref(`users/${userId}/tags`).set(userTags);
        }
        renderTagDropdowns();
    } catch (error) {
        console.error('Error cargando tags:', error);
    }

    // Load Recipes
    await loadRecipes();
}

function renderFormTagSelector(selectedTags = []) {
    const container = document.getElementById('form-tag-selector');
    if (!container) return;
    
    container.innerHTML = '';
    userTags.forEach(tag => {
        const btn = document.createElement('div');
        btn.className = `form-tag-item ${selectedTags.includes(tag) ? 'selected' : ''}`;
        btn.textContent = tag;
        btn.dataset.tag = tag;
        btn.onclick = () => btn.classList.toggle('selected');
        container.appendChild(btn);
    });
}

async function loadRecipes() {
    if (!db || !auth.currentUser) return;

    const userId = auth.currentUser.uid;
    try {
        const snapshot = await db.ref(`users/${userId}/recipes`).once('value');
        const data = snapshot.val();
        if (data) {
            recipes = Object.values(data).map(r => {
                // Migration: if it has category but no tags, convert
                if (r.category && (!r.tags || r.tags.length === 0)) {
                    r.tags = [r.category];
                }
                if (!r.tags) r.tags = [];
                return r;
            });
        } else {
            const response = await fetch('./recipes.json').catch(() => null);
            if (response && response.ok) {
                recipes = await response.json();
                recipes = recipes.map(r => {
                    if (r.category && !r.tags) r.tags = [r.category];
                    return r;
                });
                saveToDatabase();
            }
        }
        localStorage.setItem(`gusto_recipes_${userId}`, JSON.stringify(recipes));
        renderRecipes();
    } catch (error) {
        console.error('Error cargando desde Firebase:', error);
    }
}

function saveToDatabase() {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    if (db) {
        const recipesObj = {};
        recipes.forEach(r => { recipesObj[r.id] = r; });

        db.ref(`users/${userId}/recipes`).set(recipesObj)
            .then(() => console.log('Sincronizado con Firebase'))
            .catch(err => showToast('Error al sincronizar: ' + err.message, 'error'));
    }

    localStorage.setItem(`gusto_recipes_${userId}`, JSON.stringify(recipes));
}

function saveToLocalStorage() {
    saveToDatabase();
}

// --- Rendering ---

function renderRecipes() {
    const filtered = recipes.filter(r => {
        const matchesTag = currentTag === 'all' || (r.tags && r.tags.includes(currentTag));
        const matchesSearch = r.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
            r.ingredients.toLowerCase().includes(currentSearch.toLowerCase());
        const matchesView = currentView === 'home' || (currentView === 'favorites' && r.isFavorite);
        return matchesTag && matchesSearch && matchesView;
    });

    if (currentSearch || currentTag !== 'all' || currentView !== 'home') {
        randomContainer.style.display = 'none';
    } else {
        randomContainer.style.display = 'block';
        renderRandomRecipes();
    }

    recipeGrid.innerHTML = '';
    if (filtered.length === 0) {
        recipeGrid.innerHTML = `
            <div class="no-recipes">
                <ion-icon name="sad-outline"></ion-icon>
                <p>No se encontraron recetas</p>
            </div>
        `;
    }

    filtered.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        const displayTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('');
        card.innerHTML = `
            <div class="recipe-card-img-container">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="recipe-img" alt="${recipe.name}">
                <button class="favorite-btn ${recipe.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${recipe.id})">
                    <ion-icon name="${recipe.isFavorite ? 'star' : 'star-outline'}"></ion-icon>
                </button>
                ${recipe.video ? '<div class="video-badge"><ion-icon name="play"></ion-icon></div>' : ''}
            </div>
            <div class="recipe-info">
                <div class="recipe-tags">${displayTags}</div>
                <h3>${recipe.name}</h3>
                <div class="recipe-meta">
                    <span><ion-icon name="time-outline"></ion-icon> ${recipe.time || '--'} min</span>
                    <span><ion-icon name="bar-chart-outline"></ion-icon> ${recipe.difficulty || 'Media'}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => viewRecipe(recipe.id));
        recipeGrid.appendChild(card);
    });

    recipeCountText.textContent = `Tienes ${filtered.length} recetas guardadas`;
}

function renderRandomRecipes() {
    if (recipes.length === 0) {
        randomContainer.style.display = 'none';
        return;
    }
    randomTrack.innerHTML = '';
    if (randomCarouselInterval) clearInterval(randomCarouselInterval);

    const shuffled = [...recipes].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5); // 5 recipes for a better carousel

    selected.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'random-card';
        const displayTag = (recipe.tags && recipe.tags[0]) ? `<span class="tag">${recipe.tags[0]}</span>` : '';
        card.innerHTML = `
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" alt="${recipe.name}">
            <div class="random-card-info">
                <div class="recipe-tags">${displayTag}</div>
                <h3>${recipe.name}</h3>
            </div>
        `;
        card.addEventListener('click', () => viewRecipe(recipe.id));
        randomTrack.appendChild(card);
    });

    // Auto scroll logic (Web only, mobile uses native snap)
    if (window.innerWidth > 768 && selected.length > 1) {
        let currentSlide = 0;
        randomCarouselInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % selected.length;
            const cardWidth = randomTrack.querySelector('.random-card').offsetWidth + 24; // Width + gap
            randomTrack.scrollTo({
                left: cardWidth * currentSlide,
                behavior: 'smooth'
            });
        }, 5000);
    }
}

// --- Actions ---

function setupEventListeners() {
    tagContainers.forEach(container => {
        const trigger = container?.querySelector('.dropdown-trigger');
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = container.classList.contains('active');
            // Close all first
            document.querySelectorAll('.custom-dropdown, .avatar-container').forEach(el => el.classList.remove('active'));
            if (!isActive) container.classList.add('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            tagContainers.forEach(c => c?.classList.remove('active'));
        }
    });
    // Search (Desktop + Mobile)
    const searchInputs = [document.getElementById('recipe-search'), document.getElementById('recipe-search-mobile')];
    searchInputs.forEach(inp => {
        if (inp) {
            inp.addEventListener('input', (e) => {
                currentSearch = e.target.value;
                // Sync values
                searchInputs.forEach(other => { if (other !== inp) other.value = currentSearch; });
                renderRecipes();
            });
        }
    });

    // Avatar Dropdown (Click to toggle)
    document.querySelectorAll('.avatar-container').forEach(container => {
        const avatar = container.querySelector('.avatar');
        avatar?.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('active');
            // Close others
            document.querySelectorAll('.avatar-container').forEach(c => { if(c !== container) c.classList.remove('active'); });
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
        });
    });

    // Close all dropdowns on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown') && !e.target.closest('.avatar-container')) {
            document.querySelectorAll('.custom-dropdown, .avatar-container').forEach(el => el.classList.remove('active'));
        }
    });

    // Navigation Items
    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view) switchView(view);
        });
    });

    // Add Recipe Buttons
    const addBtns = [document.getElementById('add-recipe-btn-desktop'), document.getElementById('add-recipe-btn-mobile')];
    addBtns.forEach(btn => {
        btn?.addEventListener('click', () => {
            if (!checkAuth()) return;
            editingRecipeId = null;
            recipeForm.reset();
            updateImagePreview('');
            renderFormTagSelector([]); // New: Clean tag selection
            document.getElementById('modal-title').textContent = 'Nueva Receta';
            recipeModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    });

    // Tag Management Actions
    document.querySelectorAll('.manage-tags-btn').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('tags-modal').style.display = 'block';
            renderTagsManager();
        };
    });

    document.getElementById('add-tag-btn').onclick = () => {
        const name = document.getElementById('new-tag-name').value.trim();
        if (name && !userTags.includes(name)) {
            userTags.push(name);
            saveTags();
            document.getElementById('new-tag-name').value = '';
            renderTagsManager();
            renderTagDropdowns();
        }
    };

    // Universal Modal closer
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            
            const isEditingModalOpen = recipeModal.style.display === 'block';
            const isViewModalOpen = viewModal.style.display === 'block';
            
            if (isViewModalOpen) {
                editingRecipeId = null; // We are truly exiting the view
            }

            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            document.body.style.overflow = 'auto';

            if (isEditingModalOpen && editingRecipeId) {
                viewRecipe(editingRecipeId); // Return to view if we were editing and cancelled
            }
        };
    });

    // Cook Overlay closer
    document.getElementById('exit-cook-btn').onclick = () => {
        document.getElementById('cook-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    // Planner Search
    document.getElementById('planner-search-input').oninput = (e) => {
        renderPlannerSelectorList(e.target.value);
    };

    // Form Submission
    recipeForm.onsubmit = (e) => {
        e.preventDefault();
        saveRecipe();
    };

    // Modal Actions (Edit)
    editCurrentBtn?.addEventListener('click', () => {
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) {
            viewModal.style.display = 'none';
            openEditModal(r);
        }
    });

    cookModeBtn?.addEventListener('click', () => {
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) openCookMode(r);
    });

    shareRecipeBtn?.addEventListener('click', () => {
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) shareRecipe(r);
    });

    // JSON Actions from Menu
    document.querySelectorAll('.import-json-btn-menu').forEach(btn => {
        btn.onclick = () => {
            jsonInput.value = '';
            importModal.style.display = 'block';
        };
    });

    document.querySelectorAll('.export-json-btn-menu').forEach(btn => {
        btn.onclick = exportRecipes;
    });

    processJsonBtn.onclick = processImportedJson;

    // Auth Listeners
    if (auth) {
        auth.onAuthStateChanged(user => {
            const loginScreen = document.getElementById('login-screen');
            const appDiv = document.getElementById('app');
            if (user) {
                isLoggedIn = true;
                loginScreen.style.display = 'none';
                appDiv.style.display = 'flex';
                document.getElementById('user-avatar').textContent = user.displayName ? user.displayName[0] : 'U';
                document.getElementById('user-avatar-mobile').textContent = user.displayName ? user.displayName[0] : 'U';
                loadData();
            } else {
                isLoggedIn = false;
                loginScreen.style.display = 'flex';
                appDiv.style.display = 'none';
            }
        });
        document.getElementById('main-login-btn').onclick = () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider);
        };
        document.querySelectorAll('.logout-btn').forEach(btn => {
            btn.onclick = () => auth.signOut();
        });
    }
}

function checkAuth() { return isLoggedIn; }

function saveRecipe() {
    const name = document.getElementById('recipe-name').value;
    const ingredients = document.getElementById('recipe-ingredients').value;
    const steps = document.getElementById('recipe-steps').value;
    const video = document.getElementById('recipe-video').value;
    const image = document.getElementById('recipe-image').value || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`;
    const time = parseInt(document.getElementById('recipe-time').value) || 30;
    const difficulty = document.getElementById('recipe-difficulty').value;

    const tags = Array.from(document.querySelectorAll('.form-tag-item.selected'))
                     .map(el => el.dataset.tag);

    if (editingRecipeId) {
        const index = recipes.findIndex(r => r.id === editingRecipeId);
        recipes[index] = { ...recipes[index], name, tags, ingredients, steps, video, image, time, difficulty };
    } else {
        const newRecipe = {
            id: Date.now(),
            name, tags, ingredients, steps, video, image, time, difficulty,
            isFavorite: false
        };
        recipes.push(newRecipe);
    }

    saveToLocalStorage();
    renderRecipes();
    recipeModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Default state

    if (editingRecipeId) {
        viewRecipe(editingRecipeId); // Return to view after edit
    }
    
    showToast(editingRecipeId ? 'Receta actualizada' : 'Receta guardada con éxito');
}

function updateImagePreview(url) {
    if (url) {
        imagePreview.src = url;
        imagePreview.style.display = 'block';
        imagePlaceholder.style.display = 'none';
    } else {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    }
}

function openEditModal(recipe) {
    editingRecipeId = recipe.id;
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-ingredients').value = recipe.ingredients;
    document.getElementById('recipe-steps').value = recipe.steps;
    document.getElementById('recipe-video').value = recipe.video;
    document.getElementById('recipe-image').value = recipe.image || '';
    document.getElementById('recipe-time').value = recipe.time || '';
    document.getElementById('recipe-difficulty').value = recipe.difficulty || 'Media';

    updateImagePreview(recipe.image || '');
    renderFormTagSelector(recipe.tags || []); // Fill with existing tags
    document.getElementById('modal-title').textContent = 'Editar Receta';
    recipeModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}
function viewRecipe(id) {
    editingRecipeId = id;
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    const detailsContainer = document.getElementById('recipe-details');
    const embedUrl = getYoutubeEmbedUrl(recipe.video);
    const tagsHtml = (recipe.tags || []).map(t => `<span class="tag">${t}</span>`).join('');

    detailsContainer.innerHTML = `
        <div class="detail-body">
            <div class="detail-hero">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" alt="${recipe.name}">
                <div class="detail-hero-overlay"></div>
            </div>
            
            <div class="detail-content">
                <div class="detail-header-info">
                    <div class="recipe-tags" style="margin-bottom: 1rem;">${tagsHtml}</div>
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
                    <button class="btn-danger-outline" id="delete-recipe-permanent">
                        <ion-icon name="trash-outline"></ion-icon> 
                        Eliminar Receta
                    </button>
                    ${recipe.video ? `<a href="${recipe.video}" target="_blank" class="cook-video-link"><ion-icon name="logo-youtube"></ion-icon> Ver en YouTube</a>` : ''}
                </div>
            </div>
        </div>
    `;


    document.getElementById('delete-recipe-permanent').onclick = () => {
        if (confirm('¿Borrar definitivamente esta receta?')) {
            recipes = recipes.filter(r => r.id !== id);
            saveToLocalStorage();
            viewModal.style.display = 'none';
            renderRecipes();
            showToast('Receta eliminada');
        }
    };

    // Update Favorite Button in Modal
    const favIcon = favoriteCurrentBtn.querySelector('ion-icon');
    if (recipe.isFavorite) {
        favoriteCurrentBtn.classList.add('active');
        favIcon.setAttribute('name', 'star');
    } else {
        favoriteCurrentBtn.classList.remove('active');
        favIcon.setAttribute('name', 'star-outline');
    }

    favoriteCurrentBtn.onclick = () => {
        if (!checkAuth()) return;
        toggleFavorite(recipe.id);
        // Refresh local UI
        const updated = recipes.find(r => r.id === recipe.id);
        if (updated.isFavorite) {
            favoriteCurrentBtn.classList.add('active');
            favIcon.setAttribute('name', 'star');
        } else {
            favoriteCurrentBtn.classList.remove('active');
            favIcon.setAttribute('name', 'star-outline');
        }
    };

    viewModal.style.display = 'block';
}

function toggleFavorite(id) {
    if (!checkAuth()) return;
    const index = recipes.findIndex(r => r.id === id);
    if (index !== -1) {
        recipes[index].isFavorite = !recipes[index].isFavorite;
        saveToLocalStorage();
        renderRecipes();
        if (currentView === 'home' && currentTag === 'all' && !currentSearch) {
            renderRandomRecipes();
        }
    }
}

// --- Views & Features ---

function switchView(view) {
    currentView = view;
    plannerView.style.display = 'none';
    shoppingView.style.display = 'none';
    recipeGridContainer.style.display = 'none';
    randomContainer.style.display = 'none';

    if (view === 'home' || view === 'favorites') {
        recipeGridContainer.style.display = 'block';
        renderRecipes();
    } else if (view === 'planner') {
        plannerView.style.display = 'block';
        renderWeeklyPlanner();
    } else if (view === 'shopping') {
        shoppingView.style.display = 'block';
        renderShoppingList();
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
}

function renderTagDropdowns() {
    const desktopList = document.getElementById('tag-options-desktop');
    const mobileList = document.getElementById('tag-options-mobile');
    const desktopLabel = document.getElementById('current-tag-label-desktop');

    const html = `<li data-tag="all">Todas las Tags</li>` + 
        userTags.map(t => `<li data-tag="${t}">${t}</li>`).join('');
    
    if (desktopList) desktopList.innerHTML = html;
    if (mobileList) mobileList.innerHTML = html;

    const setupListeners = (list) => {
        if (!list) return;
        list.querySelectorAll('li').forEach(li => {
            li.onclick = () => {
                currentTag = li.dataset.tag;
                if (desktopLabel) desktopLabel.textContent = li.textContent;
                renderRecipes();
                document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
            };
        });
    };

    setupListeners(desktopList);
    setupListeners(mobileList);
}

function renderTagsManager() {
    const container = document.getElementById('tags-list-container');
    container.innerHTML = userTags.map((tag, i) => `
        <div class="tag-manager-item">
            <span class="tag-manager-item-name">${tag}</span>
            <div class="tag-manager-actions">
                <button class="btn-icon" onclick="editTag(${i})"><ion-icon name="create-outline"></ion-icon></button>
                <button class="btn-icon" style="color: #ef4444;" onclick="deleteTag(${i})"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        </div>
    `).join('');
}

window.editTag = (i) => {
    const newName = prompt('Nuevo nombre para la tag:', userTags[i]);
    if (newName && newName.trim()) {
        userTags[i] = newName.trim();
        saveTags();
        renderTagsManager();
        renderTagDropdowns();
    }
};

window.deleteTag = (i) => {
    if (confirm(`¿Eliminar tag "${userTags[i]}"?`)) {
        userTags.splice(i, 1);
        saveTags();
        renderTagsManager();
        renderTagDropdowns();
    }
};

function saveTags() {
    if (auth.currentUser) {
        db.ref(`users/${auth.currentUser.uid}/tags`).set(userTags);
    }
}

function processImportedJson() {
    try {
        const data = JSON.parse(jsonInput.value);
        const newRecipe = {
            id: Date.now(),
            name: data.title || 'Sin Título',
            tags: data.tags || (data.category ? [data.category] : ['Otros']),
            ingredients: Array.isArray(data.ingredients) ? data.ingredients.join('\n') : data.ingredients,
            steps: Array.isArray(data.instructions) ? data.instructions.join('\n') : data.instructions,
            video: data.video || '',
            image: data.image || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`,
            isFavorite: false
        };
        recipes.push(newRecipe);
        saveToLocalStorage();
        renderRecipes();
        importModal.style.display = 'none';
        showToast('Importado con éxito');
    } catch (e) {
        importError.textContent = 'JSON no válido';
        importError.style.display = 'block';
    }
}

function renderWeeklyPlanner() {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    plannerGrid.innerHTML = '';

    days.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'planner-day';

        const plannedRecipes = (plannerData[day] || []).map(id => {
            const r = recipes.find(rec => rec.id === id);
            return r ? `<div class="planner-recipe">
                <span>${r.name}</span>
                <button class="btn-icon circle-sm danger" onclick="removeFromPlanner('${day}', ${id})"><ion-icon name="close-outline"></ion-icon></button>
            </div>` : '';
        }).join('');

        dayDiv.innerHTML = `
            <h3>${day}</h3>
            ${plannedRecipes}
            <div class="planner-slot" onclick="openPlannerSelector('${day}')">
                <ion-icon name="add-outline"></ion-icon>
                <span>Añadir receta</span>
            </div>
        `;
        plannerGrid.appendChild(dayDiv);
    });
}

function openPlannerSelector(day) {
    activePlannerDay = day;
    document.getElementById('planner-day-name').textContent = day;
    document.getElementById('planner-search-input').value = '';
    renderPlannerSelectorList();
    document.getElementById('planner-modal').style.display = 'block';
}

function renderPlannerSelectorList(filter = '') {
    const listContainer = document.getElementById('planner-options');
    listContainer.innerHTML = '';

    const filtered = recipes.filter(r => 
        r.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="no-recipes small">No se encontraron recetas.</p>';
        return;
    }

    filtered.forEach(r => {
        const item = document.createElement('div');
        item.className = 'planner-list-item';
        item.innerHTML = `
            <img src="${r.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=200'}" class="planner-list-thumbnail">
            <span class="planner-list-name">${r.name}</span>
            <ion-icon name="add-circle-outline" style="font-size: 1.5rem;"></ion-icon>
        `;
        item.onclick = () => {
            if (!plannerData[activePlannerDay]) plannerData[activePlannerDay] = [];
            plannerData[activePlannerDay].push(r.id);
            savePlannerData();
            renderWeeklyPlanner();
            document.getElementById('planner-modal').style.display = 'none';
        };
        listContainer.appendChild(item);
    });
}

function removeFromPlanner(day, id) {
    plannerData[day] = (plannerData[day] || []).filter(rid => rid !== id);
    savePlannerData();
    renderWeeklyPlanner();
}

function savePlannerData() {
    localStorage.setItem('gusto_planner', JSON.stringify(plannerData));
}

function renderShoppingList() {
    shoppingContent.innerHTML = '';
    const allIngredients = [];

    Object.values(plannerData).flat().forEach(id => {
        const r = recipes.find(rec => rec.id === id);
        if (r && r.ingredients) {
            r.ingredients.split('\n').forEach(i => {
                if (i.trim()) allIngredients.push(i.trim());
            });
        }
    });

    if (allIngredients.length === 0) {
        shoppingContent.innerHTML = '<p class="no-recipes">Añade recetas al planificador para ver tu lista de compras.</p>';
        return;
    }

    // De-duplicate (simple)
    const unique = [...new Set(allIngredients)];

    unique.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shopping-item';
        div.innerHTML = `<span>${item}</span><ion-icon name="checkmark-circle-outline" color="primary"></ion-icon>`;
        shoppingContent.appendChild(div);
    });
}

function openCookMode(recipe) {
    cookOverlay.innerHTML = `
        <div class="cook-content">
            <header class="cook-header">
                <div class="cook-title-area">
                    <h1>${recipe.name}</h1>
                    <div id="cook-video-link-container">
                        ${recipe.video ? `<a href="${recipe.video}" target="_blank" class="cook-video-link"><ion-icon name="logo-youtube"></ion-icon> Ver Video Tutorial</a>` : ''}
                    </div>
                </div>
                <button class="btn-close-circle" onclick="document.getElementById('cook-overlay').style.display='none'"><ion-icon name="close-outline"></ion-icon></button>
            </header>

            <div class="cook-ingredients">
                <h2 class="cook-col-title">INGREDIENTES <span>(Toca para marcar)</span></h2>
                <ul class="checklist">
                    ${recipe.ingredients.split('\n').map(i => i.trim() ? `<li onclick="this.classList.toggle('checked')">${i.trim()}</li>` : '').join('')}
                </ul>
            </div>

            <div class="cook-preparation">
                <h2 class="cook-col-title">PREPARACIÓN</h2>
                <div class="cook-steps">
                    ${(recipe.steps || recipe.preparation || '').split('\n').map(p => p.trim() ? `<p>${p.trim()}</p>` : '').join('')}
                </div>
            </div>
        </div>
    `;
    cookOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function shareRecipe(recipe) {
    if (navigator.share) {
        navigator.share({
            title: 'Gusto: ' + recipe.name,
            text: `Mira esta receta: ${recipe.name}\n\nIngredientes:\n${recipe.ingredients}`,
            url: window.location.href
        }).then(() => console.log('Compartido con éxito'))
            .catch((error) => console.log('Error compartiendo', error));
    } else {
        alert('La función de compartir no está disponible en este navegador.');
    }
}

function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

function exportRecipes() {
    const dataStr = JSON.stringify(recipes, null, 4);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'recipes.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showToast('Exportando recetario...');
}

// Kickstart
init();
