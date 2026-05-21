// Recipe Data Management
let recipes = [];
let userTags = ['Carnes', 'Pastas', 'Ensaladas', 'Postres', 'Otros'];
let currentTag = 'all';
let currentSearch = '';
let editingRecipeId = null;
let currentView = 'home';
let isLoggedIn = false;
let randomCarouselInterval = null;

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

// AI Chat
const aiChatMessages = document.getElementById('ai-chat-messages');
const aiChatInput = document.getElementById('ai-chat-input');
const aiChatSendBtn = document.getElementById('ai-chat-send-btn');
const aiRecipesView = document.getElementById('ai-recipes-view');

// Explore (TheMealDB)
const exploreView = document.getElementById('explore-view');
const exploreInput = document.getElementById('explore-input');
const exploreSearchBtn = document.getElementById('explore-search-btn');
const exploreRandomBtn = document.getElementById('explore-random-btn');
const exploreGrid = document.getElementById('explore-grid');
const exploreStatus = document.getElementById('explore-status');
const exploreModal = document.getElementById('explore-modal');
const exploreDetails = document.getElementById('explore-recipe-details');
const exploreSaveBtn = document.getElementById('explore-save-btn');
const exploreChipsRow = document.getElementById('explore-chips-row');
const exploreSubchips = document.getElementById('explore-subchips');

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
let activePlannerMeal = '';

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

// Tag Dropdowns
const tagContainers = [document.getElementById('tag-dropdown-desktop'), document.getElementById('tag-dropdown-mobile')];
const tagOptionsLists = [document.getElementById('tag-options-desktop'), document.getElementById('tag-options-mobile')];
const tagLabels = [document.getElementById('current-tag-label-desktop')];

// --- Tags Dropdown Management ---
function initTagsDropdown() {
    renderTagDropdowns();
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

function filterByTag(tag) {
    currentTag = tag;
    tagLabels.forEach(label => {
        if (label) label.textContent = tag === 'all' ? 'Todas las Tags' : tag;
    });
    renderRecipes();
}

const MEALS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];

function migratePlannerData(data) {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const migrated = {};
    days.forEach(day => {
        const val = data[day];
        if (Array.isArray(val)) {
            const meals = {};
            MEALS.forEach(m => { meals[m] = []; });
            val.forEach(id => { meals['Almuerzo'].push(id); });
            migrated[day] = meals;
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
            const meals = {};
            MEALS.forEach(m => { meals[m] = val[m] || []; });
            migrated[day] = meals;
        } else {
            const meals = {};
            MEALS.forEach(m => { meals[m] = []; });
            migrated[day] = meals;
        }
    });
    return migrated;
}

let plannerData = migratePlannerData(JSON.parse(localStorage.getItem('gusto_planner')) || {});

// --- Initialization ---

async function init() {
    try {
        if (auth) {
            setupEventListeners();
            switchView('home');
            renderRandomRecipes();
            // Try initial load if auth is already restored
            if (auth.currentUser) {
                await loadData();
            }
        } else {
            console.warn('Firebase Auth no disponible');
        }
    } catch (error) {
        console.error('Error inicializando app:', error);
    }
}

async function loadData() {
    if (!db || !auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    try {
        const tagSnapshot = await db.ref(`users/${userId}/tags`).once('value');
        const tagData = tagSnapshot.val();
        if (tagData) {
            userTags = tagData;
        } else {
            db.ref(`users/${userId}/tags`).set(userTags);
        }
        renderTagDropdowns();
    } catch (error) {
        console.error('Error cargando tags:', error);
    }

    // Load planner from Firebase
    try {
        const plannerSnapshot = await db.ref(`users/${userId}/planner`).once('value');
        const plannerVal = plannerSnapshot.val();
        if (plannerVal) {
            plannerData = migratePlannerData(plannerVal);
            localStorage.setItem('gusto_planner', JSON.stringify(plannerData));
        } else {
            // No data in Firebase but may have local data
            const local = localStorage.getItem('gusto_planner');
            if (local) {
                plannerData = migratePlannerData(JSON.parse(local));
                db.ref(`users/${userId}/planner`).set(plannerData);
            }
        }
    } catch (error) {
        console.error('Error cargando planificador:', error);
    }

    await loadRecipes();

    // Handle import from public recipes
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('import') === 'true') {
        const recipeData = sessionStorage.getItem('gusto_import_recipe');
        if (recipeData) {
            try {
                const recipe = JSON.parse(recipeData);
                const newRecipe = {
                    ...recipe,
                    id: Date.now(),
                    isFavorite: false,
                    isPublic: false
                };
                recipes.push(newRecipe);
                saveToDatabase();
                renderRecipes();
                sessionStorage.removeItem('gusto_import_recipe');
                showToast('Receta agregada a tu recetario');
            } catch (e) {
                console.error('Error importing recipe:', e);
            }
        }
    }
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

    showGridSkeleton(recipeGrid);

    const userId = auth.currentUser.uid;
    try {
        const snapshot = await db.ref(`users/${userId}/recipes`).once('value');
        const data = snapshot.val();
        if (data) {
            recipes = Object.values(data).map(r => {
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
        const publicRecipesObj = {};
        recipes.forEach(r => { 
            recipesObj[r.id] = r;
            if (r.isPublic) {
                publicRecipesObj[r.id] = {
                    ...r,
                    authorId: userId,
                    authorName: auth.currentUser.displayName || 'Anónimo'
                };
                console.log(`Receta "${r.name}" marcada como pública`);
            }
        });

        db.ref(`users/${userId}/recipes`).set(recipesObj)
            .then(() => console.log('Recetas sincronizadas'))
            .catch(err => console.error('Error sincronizando recetas:', err));

        if (Object.keys(publicRecipesObj).length > 0) {
            db.ref('public_recipes').transaction(currentPublic => {
                const merged = currentPublic || {};
                Object.keys(merged).forEach(key => {
                    if (merged[key].authorId === userId) delete merged[key];
                });
                Object.assign(merged, publicRecipesObj);
                return merged;
            }).then(() => console.log('Recetas públicas sincronizadas'))
              .catch(err => console.error('Error sync public recipes:', err));
        } else {
            db.ref('public_recipes').transaction(currentPublic => {
                if (!currentPublic) return null;
                const cleaned = { ...currentPublic };
                Object.keys(cleaned).forEach(key => {
                    if (cleaned[key].authorId === userId) delete cleaned[key];
                });
                return Object.keys(cleaned).length > 0 ? cleaned : null;
            });
        }
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
                <span class="material-icons">sentiment_dissatisfied</span>
                <p>No se encontraron recetas</p>
            </div>
        `;
    }

    filtered.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        const displayTags = (recipe.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('');
        const publicBadge = recipe.isPublic ? '<div class="public-badge"><span class="material-icons">public</span></div>' : '';
        card.innerHTML = `
            <div class="recipe-card-img-container">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="recipe-img" alt="${recipe.name}">
                <button class="favorite-btn ${recipe.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${recipe.id})">
                    <span class="material-icons">${recipe.isFavorite ? 'star' : 'star_outline'}</span>
                </button>
                ${publicBadge}
                 ${recipe.video ? '<div class="video-badge"><span class="material-icons">play_arrow</span></div>' : ''}
            </div>
            <div class="recipe-info">
                <div class="recipe-tags">${displayTags}</div>
                <h3>${recipe.name}</h3>
                <div class="recipe-meta">
                     <span><span class="material-icons">schedule</span> ${recipe.time || '--'} min</span>
                     <span><span class="material-icons">bar_chart</span> ${recipe.difficulty || 'Media'}</span>
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
    const selected = shuffled.slice(0, 5);

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

    if (window.innerWidth > 768 && selected.length > 1) {
        let currentSlide = 0;
        randomCarouselInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % selected.length;
            const cardWidth = randomTrack.querySelector('.random-card').offsetWidth + 24;
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
            document.querySelectorAll('.custom-dropdown, .avatar-container').forEach(el => el.classList.remove('active'));
            if (!isActive) container.classList.add('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            tagContainers.forEach(c => c?.classList.remove('active'));
        }
    });

    const searchInputs = [document.getElementById('recipe-search'), document.getElementById('recipe-search-mobile')];
    searchInputs.forEach(inp => {
        if (inp) {
            inp.addEventListener('input', (e) => {
                currentSearch = e.target.value;
                searchInputs.forEach(other => { if (other !== inp) other.value = currentSearch; });
                renderRecipes();
            });
        }
    });

    document.querySelectorAll('.avatar-container').forEach(container => {
        const avatar = container.querySelector('.avatar');
        avatar?.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('active');
            document.querySelectorAll('.avatar-container').forEach(c => { if(c !== container) c.classList.remove('active'); });
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown') && !e.target.closest('.avatar-container')) {
            document.querySelectorAll('.custom-dropdown, .avatar-container').forEach(el => el.classList.remove('active'));
        }
    });

    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view) switchView(view);
        });
    });

    const addBtns = [document.getElementById('add-recipe-btn-desktop'), document.getElementById('add-recipe-btn-mobile')];
    addBtns.forEach(btn => {
        btn?.addEventListener('click', () => {
            if (!checkAuth()) return;
            editingRecipeId = null;
            recipeForm.reset();
            updateImagePreview('');
            renderFormTagSelector([]);
            document.getElementById('modal-title').textContent = 'Nueva Receta';
            recipeModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    });

    searchGoogleBtn?.addEventListener('click', () => {
        const name = document.getElementById('recipe-name').value.trim();
        if (name) {
            window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name)}`, '_blank');
        } else {
            document.getElementById('recipe-name').focus();
        }
    });

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

    // AI Kitchen buttons in avatar dropdown
    document.querySelectorAll('.ai-kitchen-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.avatar-container').forEach(c => c.classList.remove('active'));
            switchView('ai');
        });
    });

    // Explore buttons in avatar dropdown
    document.querySelectorAll('.explore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.avatar-container').forEach(c => c.classList.remove('active'));
            switchView('explore');
            if (exploreSubchips && exploreSubchips.children.length === 0) {
                loadExploreChips('categories');
            }
        });
    });

    // Explore search & random
    exploreSearchBtn?.addEventListener('click', () => {
        const q = exploreInput.value.trim();
        if (q) searchExplore(q);
    });
    exploreInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const q = exploreInput.value.trim();
            if (q) searchExplore(q);
        }
    });
    exploreRandomBtn?.addEventListener('click', getRandomExplore);

    // Explore subchip clicks (categories/areas)
    exploreSubchips?.addEventListener('click', (e) => {
        const chip = e.target.closest('.explore-subchip');
        if (chip) {
            const type = chip.dataset.type;
            const value = chip.dataset.value;
            filterExplore(type, value);
        }
    });

    // Explore chip toggles (categories/areas)
    document.querySelectorAll('.explore-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.explore-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            loadExploreChips(chip.dataset.cat);
        });
    });

    // Explore save button (deshabilitado temporalmente, ver saveExploreRecipe)
    // exploreSaveBtn?.addEventListener('click', saveExploreRecipe);

    // Explore modal close
    const closeExploreModal = () => {
        exploreModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    exploreModal?.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeExploreModal);
    });
    exploreModal?.addEventListener('click', (e) => {
        if (e.target === exploreModal) closeExploreModal();
    });

    // AI Chat send
    aiChatSendBtn?.addEventListener('click', sendAIChat);

    aiChatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIChat();
        }
    });

    // Event delegation for save AI recipe buttons
    aiChatMessages?.addEventListener('click', (e) => {
        const btn = e.target.closest('.save-ai-recipe-btn');
        if (btn) {
            const index = parseInt(btn.dataset.index);
            const recipeData = aiGeneratedRecipes[index];
            if (recipeData) saveAIRecipe(recipeData);
        }
    });

    // AI config button (Hugging Face token)
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            
            const isEditingModalOpen = recipeModal.style.display === 'block';
            const isViewModalOpen = viewModal.style.display === 'block';
            
            if (isViewModalOpen) {
                editingRecipeId = null;
            }

            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            document.body.style.overflow = 'auto';

            if (isEditingModalOpen && editingRecipeId) {
                viewRecipe(editingRecipeId);
            }
        };
    });

    document.getElementById('exit-cook-btn').onclick = () => {
        document.getElementById('cook-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    document.getElementById('planner-search-input').oninput = (e) => {
        renderPlannerSelectorList(e.target.value);
    };

    recipeForm.onsubmit = (e) => {
        e.preventDefault();
        saveRecipe();
    };

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

    if (auth) {
        const loginScreen = document.getElementById('login-screen');
        const appDiv = document.getElementById('app');
        const loadingAuth = document.getElementById('loading-auth');
        const loginForm = document.getElementById('login-form');
        const authCard = document.getElementById('auth-card');

        // Show loading initially
        loadingAuth.style.display = 'block';
        loginForm.style.display = 'none';
        loginScreen.style.display = 'flex';
        appDiv.style.display = 'none';

        auth.onAuthStateChanged(async user => {
            if (user) {
                isLoggedIn = true;
                loginScreen.style.display = 'none';
                appDiv.style.display = 'flex';
                showGridSkeleton(recipeGrid);
                document.getElementById('user-avatar').textContent = user.displayName ? user.displayName[0] : 'U';
                document.getElementById('user-avatar-mobile').textContent = user.displayName ? user.displayName[0] : 'U';
                await loadData();
                // Re-render planner if user navigated to it while loading
                if (currentView === 'planner') renderWeeklyPlanner();
                if (currentView === 'shopping') renderShoppingList();
            } else {
                isLoggedIn = false;
                loadingAuth.style.display = 'none';
                loginForm.style.display = 'block';
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

    // Import/Export JSON
    document.querySelectorAll('#import-json-btn-desktop, #import-json-btn-mobile').forEach(btn => {
        btn?.addEventListener('click', () => {
            document.querySelectorAll('.avatar-container').forEach(c => c.classList.remove('active'));
            importError.style.display = 'none';
            jsonInput.value = '';
            importModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    });

    document.querySelectorAll('#export-json-btn-desktop, #export-json-btn-mobile').forEach(btn => {
        btn?.addEventListener('click', () => {
            document.querySelectorAll('.avatar-container').forEach(c => c.classList.remove('active'));
            exportRecipes();
        });
    });

    processJsonBtn?.addEventListener('click', processImportedJson);
}

function checkAuth() { return isLoggedIn; }

function validateIngredients(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const errors = [];
    lines.forEach((line, i) => {
        const parts = line.split('|');
        if (parts.length < 2 || parts.length > 3) {
            errors.push(`Línea ${i + 1}: "${line.trim()}" → Formato: ingrediente|cantidad|unidad`);
        } else if (!parts[0].trim()) {
            errors.push(`Línea ${i + 1}: El nombre del ingrediente está vacío`);
        } else if (!parts[1].trim()) {
            errors.push(`Línea ${i + 1}: La cantidad está vacía`);
        }
    });
    return errors;
}

function parseIngredients(text) {
    return text.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split('|').map(p => p.trim());
        return {
            name: parts[0],
            cantidad: parts[1] || '',
            unidad: parts[2] || ''
        };
    });
}

function formatIngredients(ingredients) {
    if (typeof ingredients !== 'string') return ingredients;
    if (ingredients.includes('|')) {
        return parseIngredients(ingredients);
    }
    return ingredients;
}

function renderIngredientLine(ing) {
    if (typeof ing === 'string') {
        const parts = ing.split('|').map(p => p.trim());
        if (parts.length >= 2 && parts[0]) {
            if (parts[2]) return `${parts[0]} — ${parts[1]} ${parts[2]}`;
            return `${parts[0]} — ${parts[1]}`;
        }
        return ing;
    }
    if (ing.cantidad && ing.unidad) return `${ing.name} — ${ing.cantidad} ${ing.unidad}`;
    if (ing.cantidad) return `${ing.name} — ${ing.cantidad}`;
    return ing.name;
}

function saveRecipe() {
    const name = document.getElementById('recipe-name').value;
    const ingredientsRaw = document.getElementById('recipe-ingredients').value;
    const steps = document.getElementById('recipe-steps').value;
    const video = document.getElementById('recipe-video').value;
    const image = document.getElementById('recipe-image').value || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`;
    const time = parseInt(document.getElementById('recipe-time').value) || 30;
    const difficulty = document.getElementById('recipe-difficulty').value;

    const errors = validateIngredients(ingredientsRaw);
    if (errors.length > 0) {
        showToast(errors[0], 'error');
        return;
    }

    const tags = Array.from(document.querySelectorAll('.form-tag-item.selected'))
                     .map(el => el.dataset.tag);

    const isPublic = document.getElementById('recipe-public-toggle')?.checked || false;

    if (editingRecipeId) {
        const index = recipes.findIndex(r => r.id === editingRecipeId);
        recipes[index] = { ...recipes[index], name, tags, ingredients: ingredientsRaw, steps, video, image, time, difficulty, isPublic };
    } else {
        const newRecipe = {
            id: Date.now(),
            name, tags, ingredients: ingredientsRaw, steps, video, image, time, difficulty,
            isFavorite: false,
            isPublic: isPublic
        };
        recipes.push(newRecipe);
    }

    saveToLocalStorage();
    renderRecipes();
    recipeModal.style.display = 'none';
    document.body.style.overflow = 'auto';

    if (editingRecipeId) {
        viewRecipe(editingRecipeId);
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
    renderFormTagSelector(recipe.tags || []);
    document.getElementById('modal-title').textContent = 'Editar Receta';
    
    // Set public toggle
    const toggle = document.getElementById('recipe-public-toggle');
    if (toggle) toggle.checked = recipe.isPublic || false;
    
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
    const ingredientsHtml = (recipe.ingredients || '').split('\n').filter(l => l.trim()).map(l => `<div class="ingredient-item">${renderIngredientLine(l)}</div>`).join('');

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
                     <span><span class="material-icons">schedule</span> ${recipe.time || '--'} min</span>
                     <span><span class="material-icons">bar_chart</span> ${recipe.difficulty || 'Media'}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h3 class="detail-section-title">Ingredientes</h3>
                    <div class="detail-ingredients">${ingredientsHtml}</div>
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
                         <span class="material-icons">delete</span> 
                         Eliminar Receta
                     </button>
                     ${recipe.video ? `<a href="${recipe.video}" target="_blank" class="cook-video-link"><span class="material-icons">smart_display</span> Ver en YouTube</a>` : ''}
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

    const favIcon = favoriteCurrentBtn.querySelector('.material-icons');
    if (recipe.isFavorite) {
        favoriteCurrentBtn.classList.add('active');
        favIcon.textContent = 'star';
    } else {
        favoriteCurrentBtn.classList.remove('active');
        favIcon.textContent = 'star_outline';
    }

    favoriteCurrentBtn.onclick = () => {
        if (!checkAuth()) return;
        toggleFavorite(recipe.id);
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
    if (aiRecipesView) aiRecipesView.style.display = 'none';
    if (exploreView) exploreView.style.display = 'none';

    if (view === 'home' || view === 'favorites') {
        recipeGridContainer.style.display = 'block';
        renderRecipes();
    } else if (view === 'planner') {
        plannerView.style.display = 'block';
        renderWeeklyPlanner();
    } else if (view === 'shopping') {
        shoppingView.style.display = 'block';
        renderShoppingList();
    } else if (view === 'ai' && aiRecipesView) {
        aiRecipesView.style.display = 'block';
    } else if (view === 'explore' && exploreView) {
        exploreView.style.display = 'block';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
}

// --- AI Chat Functions (Generador Local) ---

let aiIsGenerating = false;
let aiGeneratedRecipes = [];

function scrollAIChat() {
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'ai-message ai-user-message';
    div.innerHTML = `<div class="ai-message-content"><p>${escapeHtml(text)}</p></div>`;
    aiChatMessages.appendChild(div);
    scrollAIChat();
}

function addAILoading() {
    const div = document.createElement('div');
    div.className = 'ai-message ai-bot-message';
    div.id = 'ai-loading';
    div.innerHTML = `
        <div class="ai-avatar"><span class="material-icons">auto_awesome</span></div>
        <div class="ai-message-content">
            <div class="ai-thinking">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
            </div>
            <p style="opacity: 0.6; font-size: 0.85rem; margin-top: 4px;">Generando receta...</p>
        </div>
    `;
    aiChatMessages.appendChild(div);
    scrollAIChat();
}

function removeAILoading() {
    const el = document.getElementById('ai-loading');
    if (el) el.remove();
}

function addAIMessage(recipeData) {
    const recipeIndex = aiGeneratedRecipes.length;
    aiGeneratedRecipes.push(recipeData);

    const div = document.createElement('div');
    div.className = 'ai-message ai-bot-message';

    const tagsHtml = (recipeData.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const ingredientsHtml = (recipeData.ingredients || []).map(ing =>
        `<div class="ingredient-item">
            <span class="ingredient-name">${escapeHtml(ing.name)}</span>
            <span class="ingredient-qty">${escapeHtml(ing.quantity || '')} ${escapeHtml(ing.unit || '')}</span>
        </div>`
    ).join('');
    const instructionsHtml = (recipeData.instructions || []).map((step, i) =>
        `<div class="ai-step">${i + 1}. ${escapeHtml(step)}</div>`
    ).join('');

    div.innerHTML = `
        <div class="ai-avatar"><span class="material-icons">auto_awesome</span></div>
        <div class="ai-message-content">
            <div class="ai-recipe-card glass">
                <div class="ai-recipe-header">
                    <h3>${escapeHtml(recipeData.title)}</h3>
                    <div class="ai-recipe-meta">
                        <span><span class="material-icons">schedule</span> ${recipeData.time || '--'} min</span>
                        <span><span class="material-icons">bar_chart</span> ${escapeHtml(recipeData.difficulty || 'Media')}</span>
                    </div>
                    <div class="recipe-tags" style="margin-top: 8px;">${tagsHtml}</div>
                </div>
                <div class="ai-recipe-section">
                    <h4>Ingredientes</h4>
                    <div class="ai-ingredients">${ingredientsHtml}</div>
                </div>
                <div class="ai-recipe-section">
                    <h4>Preparación</h4>
                    <div class="ai-instructions">${instructionsHtml}</div>
                </div>
                <button class="btn-primary save-ai-recipe-btn" data-index="${recipeIndex}">
                    <span class="material-icons">save</span> Guardar en Mis Recetas
                </button>
            </div>
        </div>
    `;

    aiChatMessages.appendChild(div);
    scrollAIChat();
}

async function sendAIChat() {
    if (!checkAuth()) return;
    if (aiIsGenerating) return;

    const text = aiChatInput.value.trim();
    if (!text) return;

    aiChatInput.value = '';
    addUserMessage(text);
    aiIsGenerating = true;
    aiChatSendBtn.disabled = true;
    addAILoading();

    setTimeout(() => {
        try {
            const recipeData = generateLocalRecipe(text);
            removeAILoading();
            addAIMessage(recipeData);
        } catch (error) {
            removeAILoading();
            const div = document.createElement('div');
            div.className = 'ai-message ai-bot-message';
            div.innerHTML = `
                <div class="ai-avatar"><span class="material-icons">error_outline</span></div>
                <div class="ai-message-content">
                    <p style="color: var(--primary);">${escapeHtml(error.message || 'Error al generar la receta')}</p>
                    <button class="btn-secondary-sm" onclick="sendAIChat()" style="margin-top: 8px;">
                        <span class="material-icons">refresh</span> Reintentar
                    </button>
                </div>
            `;
            aiChatMessages.appendChild(div);
            scrollAIChat();
        } finally {
            aiIsGenerating = false;
            aiChatSendBtn.disabled = false;
        }
    }, 400);
}

// --- Generador Local de Recetas ---

const CUISINES = [
    {
        id: 'mexicana', tags: ['Mexicana', 'Tradicional'],
        proteins: ['Pollo', 'Carne de res', 'Cerdo', 'Chorizo', 'Pescado'],
        veggies: ['Cebolla', 'Aguacate', 'Tomate', 'Chile', 'Maíz', 'Frijoles', 'Cilantro'],
        spices: ['Comino', 'Chile en polvo', 'Orégano', 'Cilantro', 'Ajo', 'Epazote'],
        bases: ['Tortillas de maíz', 'Arroz', 'Frijoles refritos'],
        methods: ['asar', 'guisar', 'freír', 'hervir', 'estofar'],
        nameAdj: ['Tradicionales', 'Estilo México', 'Caseros', 'Con Salsa', 'Rusticos'],
        templates: [
            { name: '{adj} {protein} {method}', suffix: 'con {veggie}' },
            { name: '{protein} {method} {adj}', suffix: 'al estilo {veggie}' },
            { name: 'Tacos de {protein} {adj}', suffix: 'con {veggie}' }
        ],
        times: [20, 60], difficulty: 'Fácil'
    },
    {
        id: 'italiana', tags: ['Italiana', 'Pastas'],
        proteins: ['Pollo', 'Carne molida', 'Salchicha', 'Atún', 'Anchoas', 'Prosciutto'],
        veggies: ['Tomate', 'Albahaca', 'Champiñones', 'Cebolla', 'Ajo', 'Berenjena', 'Zucchini'],
        spices: ['Albahaca', 'Orégano', 'Romero', 'Tomillo', 'Ajo', 'Perejil'],
        bases: ['Pasta', 'Arroz arborio', 'Polenta'],
        methods: ['hervir', 'saltear', 'hornear', 'estofar'],
        nameAdj: ['Clásica', 'Tradicional', 'Casera', 'Rústica', 'Napolitana'],
        templates: [
            { name: '{protein} {method} {adj}', suffix: 'con {veggie}' },
            { name: 'Pasta con {protein} y {veggie}', suffix: '{adj}' },
            { name: 'Risotto de {veggie} {adj}', suffix: 'con {protein}' }
        ],
        times: [25, 90], difficulty: 'Media'
    },
    {
        id: 'japonesa', tags: ['Japonesa', 'Asiática'],
        proteins: ['Salmón', 'Pollo', 'Tofu', 'Cerdo', 'Camarones'],
        veggies: ['Repollo', 'Zanahoria', 'Cebolla', 'Jengibre', 'Cebolla de verdeo', 'Brotes de soja'],
        spices: ['Salsa de soja', 'Jengibre', 'Mirín', 'Wasabi', 'Aceite de sésamo'],
        bases: ['Arroz jazmín', 'Fideos udon', 'Fideos soba'],
        methods: ['saltear', 'cocer al vapor', 'freír', 'asar'],
        nameAdj: ['Teriyaki', 'Tempura', 'Al estilo japonés', 'Con Sésamo'],
        templates: [
            { name: '{protein} {adj}', suffix: 'con {veggie}' },
            { name: '{protein} {method} {adj}', suffix: 'y {veggie}' },
            { name: '{adj} de {protein}', suffix: 'con {veggie}' }
        ],
        times: [15, 45], difficulty: 'Media'
    },
    {
        id: 'china', tags: ['China', 'Asiática'],
        proteins: ['Pollo', 'Cerdo', 'Tofu', 'Res', 'Camarones'],
        veggies: ['Brócoli', 'Zanahoria', 'Cebolla', 'Pimiento', 'Champiñones', 'Repollo'],
        spices: ['Salsa de soja', 'Aceite de sésamo', 'Jengibre', 'Cinco especias', 'Ajo'],
        bases: ['Arroz', 'Fideos chinos'],
        methods: ['saltear', 'freír', 'cocer al vapor', 'estofar'],
        nameAdj: ['Agridulce', 'Con Salsa', 'Salteado', 'Estilo Cantonés'],
        templates: [
            { name: '{protein} {adj}', suffix: 'con {veggie}' },
            { name: '{protein} {method} con {veggie}', suffix: '{adj}' },
            { name: '{veggie} {method} con {protein}', suffix: '{adj}' }
        ],
        times: [15, 40], difficulty: 'Fácil'
    },
    {
        id: 'india', tags: ['India', 'Especiada'],
        proteins: ['Pollo', 'Cordero', 'Garbanzos', 'Paneer', 'Pescado'],
        veggies: ['Cebolla', 'Espinaca', 'Tomate', 'Papa', 'Coliflor'],
        spices: ['Curry', 'Cúrcuma', 'Comino', 'Jengibre', 'Cardamomo', 'Clavo de olor'],
        bases: ['Arroz basmati', 'Pan naan'],
        methods: ['cocinar a fuego lento', 'estofar', 'saltear', 'hornear'],
        nameAdj: ['Tikka Masala', 'Curry', 'Con Especias', 'Vindaloo', 'Korma'],
        templates: [
            { name: '{protein} {adj}', suffix: 'con {veggie}' },
            { name: '{adj} de {protein} {method}', suffix: 'con {veggie}' },
            { name: '{veggie} {method} {adj}', suffix: 'con {protein}' }
        ],
        times: [30, 90], difficulty: 'Media'
    },
    {
        id: 'mediterranea', tags: ['Mediterránea', 'Saludable'],
        proteins: ['Pescado', 'Pollo', 'Cordero', 'Garbanzos', 'Huevos'],
        veggies: ['Tomate', 'Pepino', 'Pimiento', 'Berenjena', 'Aceitunas', 'Espinaca'],
        spices: ['Orégano', 'Romero', 'Ajo', 'Limón', 'Aceite de oliva'],
        bases: ['Pan pita', 'Cuscús', 'Arroz'],
        methods: ['asar', 'hornear', 'saltear', 'gratinar'],
        nameAdj: ['Al Horno', 'A la Parrilla', 'Mediterráneo', 'Con Hierbas'],
        templates: [
            { name: '{protein} {method} {adj}', suffix: 'con {veggie}' },
            { name: 'Ensalada de {veggie} {adj}', suffix: 'con {protein}' },
            { name: '{veggie} rellenos de {protein}', suffix: '{adj}' }
        ],
        times: [20, 60], difficulty: 'Fácil'
    },
    {
        id: 'argentina', tags: ['Argentina', 'Parrilla'],
        proteins: ['Carne de res', 'Pollo', 'Chorizo', 'Morcilla', 'Cerdo'],
        veggies: ['Cebolla', 'Pimiento', 'Tomate', 'Lechuga', 'Papa', 'Batata'],
        spices: ['Perejil', 'Ajo', 'Orégano', 'Aceite de oliva', 'Sal gruesa'],
        bases: ['Pan', 'Arroz', 'Papas'],
        methods: ['asar a la parrilla', 'saltear', 'hervir', 'guisar'],
        nameAdj: ['A la Parrilla', 'Criollo', 'Con Chimichurri', 'Al Disco'],
        templates: [
            { name: '{protein} {adj}', suffix: 'con {veggie}' },
            { name: '{veggie} {method} {adj}', suffix: 'con {protein}' },
            { name: '{protein} {method} con {veggie}', suffix: '{adj}' }
        ],
        times: [25, 120], difficulty: 'Media'
    },
    {
        id: 'thai', tags: ['Thai', 'Asiática'],
        proteins: ['Pollo', 'Camarones', 'Tofu', 'Cerdo', 'Pescado'],
        veggies: ['Cebolla', 'Pimiento', 'Zanahoria', 'Cilantro', 'Brotes de soja'],
        spices: ['Leche de coco', 'Curry verde', 'Salsa de pescado', 'Lemongrass', 'Chile'],
        bases: ['Arroz jazmín', 'Fideos de arroz'],
        methods: ['saltear', 'cocer a fuego lento', 'freír', 'hervir'],
        nameAdj: ['Thai', 'Con Leche de Coco', 'Picante', 'Con Albahaca'],
        templates: [
            { name: '{protein} {adj}', suffix: 'con {veggie}' },
            { name: '{adj} de {protein} {method}', suffix: 'con {veggie}' },
            { name: 'Pad Thai de {protein}', suffix: 'con {veggie}' }
        ],
        times: [20, 45], difficulty: 'Media'
    },
    {
        id: 'americana', tags: ['Americana', 'Clásica'],
        proteins: ['Carne de res', 'Pollo', 'Cerdo', 'Pescado', 'Huevos'],
        veggies: ['Lechuga', 'Tomate', 'Cebolla', 'Maíz', 'Papa', 'Zanahoria'],
        spices: ['Pimienta', 'Ajo', 'Cebolla en polvo', 'Pimentón', 'Mostaza'],
        bases: ['Pan de hamburguesa', 'Papas', 'Arroz'],
        methods: ['asar', 'freír', 'hornear', 'saltear'],
        nameAdj: ['Clásico', 'A la Barbacoa', 'Crocante', 'Rústico'],
        templates: [
            { name: '{protein} {adj}', suffix: 'con {veggie}' },
            { name: '{veggie} {method} con {protein}', suffix: '{adj}' },
            { name: '{protein} {method} {adj}', suffix: 'y {veggie}' }
        ],
        times: [15, 90], difficulty: 'Fácil'
    },
    {
        id: 'francesa', tags: ['Francesa', 'Gourmet'],
        proteins: ['Pollo', 'Pescado', 'Cordero', 'Huevos', 'Carne de res'],
        veggies: ['Champiñones', 'Cebolla', 'Zanahoria', 'Puerro', 'Papas', 'Espárragos'],
        spices: ['Tomillo', 'Romero', 'Estragón', 'Laurel', 'Nuez moscada'],
        bases: ['Pan baguette', 'Papas', 'Arroz'],
        methods: ['estofar', 'gratinar', 'saltear', 'hornear', 'pochado'],
        nameAdj: ['Gratinado', 'Estilo Francés', 'Con Salsa', 'Sofisticado'],
        templates: [
            { name: '{protein} {method} {adj}', suffix: 'con {veggie}' },
            { name: '{veggie} {method} {adj}', suffix: 'con {protein}' },
            { name: '{adj} de {protein} y {veggie}', suffix: '' }
        ],
        times: [30, 120], difficulty: 'Difícil'
    }
];

const ALL_VERBS = ['Cortar', 'Picar', 'Lavar', 'Pelar', 'Marinar', 'Sazonar', 'Calentar', 'Mezclar', 'Revolver', 'Incorporar', 'Agregar', 'Verter', 'Cocinar', 'Hornear', 'Freír', 'Saltear', 'Hervir', 'Asar', 'Estofar', 'Gratinar', 'Reposar', 'Servir', 'Decorar', 'Espolvorear', 'Rociar'];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function pickN(list, n) {
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
}

function matchCuisine(text) {
    const lower = text.toLowerCase();
    const keywords = {
        mexicana: ['mexican', 'taco', 'tortilla', 'chile', 'guacamole', 'frijol'],
        italiana: ['italian', 'pasta', 'pizza', 'risotto', 'lasañ', 'parmesano'],
        japonesa: ['japonés', 'japonesa', 'sushi', 'ramen', 'teriyaki', 'udon', 'wasabi'],
        china: ['chino', 'china', 'wok', 'soja'],
        india: ['indio', 'india', 'curry', 'cúrcuma', 'garbanzo', 'tikka'],
        mediterranea: ['mediterráneo', 'mediterránea', 'griega', 'griego'],
        argentina: ['argentino', 'argentina', 'parrilla', 'asado', 'chimichurri'],
        thai: ['thai', 'tailandés', 'tailandesa', 'pad thai'],
        francesa: ['francés', 'francesa', 'gourmet', 'baguette'],
        americana: ['hamburguesa', 'burguer', 'bbq', 'barbacoa', 'americana', 'americano']
    };
    for (const [id, words] of Object.entries(keywords)) {
        if (words.some(w => lower.includes(w))) {
            return CUISINES.find(c => c.id === id);
        }
    }
    return null;
}

function extractRequestedIngredients(text) {
    const known = [
        'pollo', 'carne', 'res', 'cerdo', 'pescado', 'camarones', 'atún', 'salmón', 'trucha',
        'tofu', 'huevo', 'huevos', 'chorizo', 'salchicha', 'cordero',
        'tomate', 'cebolla', 'ajo', 'zanahoria', 'papa', 'papas', 'brócoli', 'espinaca',
        'champiñones', 'pimiento', 'calabaza', 'berenjena', 'aguacate', 'lechuga',
        'limón', 'lima', 'naranja', 'arroz', 'pasta', 'quinoa', 'lentejas', 'garbanzos',
        'queso', 'crema', 'leche', 'yogur'
    ];
    const lower = text.toLowerCase();
    return known.filter(k => lower.includes(k));
}

const ALL_PROTEINS = [...new Set(CUISINES.flatMap(c => c.proteins))].map(p => p.toLowerCase());
const ALL_VEGGIES = [...new Set(CUISINES.flatMap(c => c.veggies))].map(v => v.toLowerCase());

function findIngredientName(lower) {
    for (const c of CUISINES) {
        for (const list of [c.proteins, c.veggies, c.spices]) {
            const match = list.find(item => item.toLowerCase() === lower);
            if (match) return match;
        }
    }
    return capitalize(lower);
}

function generateLocalRecipe(userText) {
    const lower = userText.toLowerCase();

    const isVegetariano = lower.includes('vegetariano') || lower.includes('vegano') ||
        lower.includes('sin carne') || lower.includes('verdura');
    const isRapido = lower.includes('rápido') || lower.includes('rapido') || lower.includes('rápida') ||
        lower.includes('rapida') || lower.includes('fácil') || lower.includes('facil');
    const isSaludable = lower.includes('saludable') || lower.includes('light') ||
        lower.includes('bajo en') || lower.includes('dieta');

    // Categorize user's requested ingredients
    const requested = extractRequestedIngredients(userText);
    const requestedProteins = [];
    const requestedVeggies = [];
    const requestedOther = [];

    requested.forEach(ing => {
        if (ALL_PROTEINS.includes(ing)) {
            requestedProteins.push(findIngredientName(ing));
        } else if (ALL_VEGGIES.includes(ing)) {
            requestedVeggies.push(findIngredientName(ing));
        } else {
            requestedOther.push(capitalize(ing));
        }
    });

    // Determine cuisine based on user's request
    let cuisine = matchCuisine(userText);

    if (!cuisine) {
        if (requestedProteins.length > 0) {
            const match = CUISINES.filter(c =>
                c.proteins.some(p => p.toLowerCase() === requestedProteins[0].toLowerCase())
            );
            if (match.length > 0) cuisine = pick(match);
        }
        if (!cuisine && requestedVeggies.length > 0) {
            const match = CUISINES.filter(c =>
                c.veggies.some(v => v.toLowerCase() === requestedVeggies[0].toLowerCase())
            );
            if (match.length > 0) cuisine = pick(match);
        }
        if (!cuisine) cuisine = pick(CUISINES);
    }

    // Select main ingredient (priority: user request > vegetarian > random)
    let mainProtein;
    if (requestedProteins.length > 0) {
        mainProtein = requestedProteins[0];
    } else if (isVegetariano) {
        mainProtein = pick(cuisine.veggies);
    } else {
        mainProtein = pick(cuisine.proteins);
    }

    // Select veggies: include user-requested + random from cuisine
    let veggies = [...requestedVeggies];
    const extraCount = 2 + Math.floor(Math.random() * 2);
    const available = cuisine.veggies.filter(v =>
        !veggies.some(rv => rv.toLowerCase() === v.toLowerCase())
    );
    veggies.push(...pickN(available, extraCount));
    veggies = [...new Set(veggies.map(v => v.toLowerCase()))].map(capitalize);

    // Build and deduplicate ingredient list
    let selectedIngredients = [mainProtein, ...veggies, ...requestedOther];
    selectedIngredients = [...new Set(selectedIngredients.map(s => s.toLowerCase()))];
    selectedIngredients = selectedIngredients.slice(0, 7);

    // Method
    let method = pick(cuisine.methods);

    // Time estimation
    let totalTime;
    if (isRapido) {
        totalTime = 10 + Math.floor(Math.random() * 20); // 10-30 min
    } else {
        const [minTime, maxTime] = cuisine.times;
        totalTime = minTime + Math.floor(Math.random() * (maxTime - minTime));
    }

    // Difficulty
    let difficulty;
    if (isRapido) difficulty = 'Fácil';
    else if (totalTime > 60 && Math.random() > 0.5) difficulty = 'Difícil';
    else difficulty = pick(['Fácil', 'Fácil', 'Media', 'Media', 'Difícil']);

    // Generate name
    const adj = pick(cuisine.nameAdj);
    const template = pick(cuisine.templates);
    let name = template.name
        .replace('{protein}', capitalize(mainProtein))
        .replace('{method}', method)
        .replace('{adj}', adj)
        .replace('{veggie}', capitalize(pick(veggies)));
    const suffix = template.suffix
        .replace('{veggie}', capitalize(pick(veggies)))
        .replace('{protein}', capitalize(mainProtein))
        .replace('{method}', method)
        .replace('{adj}', pick(cuisine.nameAdj));
    if (suffix) name += ' ' + suffix;

    // Tags
    const tags = [...cuisine.tags];
    if (isVegetariano) tags.push('Vegetariano');
    if (isRapido) tags.push('Rápido');
    if (isSaludable) tags.push('Saludable');
    if (totalTime > 60) tags.push('Elaborado');

    // Generate ingredients with quantities
    const qtyMap = {
        'Pollo': ['2-3', 'unidades'], 'Carne de res': ['500', 'gr'], 'Cerdo': ['400', 'gr'],
        'Pescado': ['400', 'gr'], 'Camarones': ['300', 'gr'], 'Salmón': ['2', 'filetes'],
        'Tofu': ['200', 'gr'], 'Huevos': ['4', 'unidades'], 'Chorizo': ['2', 'unidades'],
        'Cordero': ['500', 'gr'], 'Garbanzos': ['1', 'lata'],
        'Cebolla': ['1', 'unidad grande'], 'Aguacate': ['1', 'unidad'],
        'Tomate': ['2', 'unidades'], 'Chile': ['1', 'unidad'],
        'Maíz': ['1', 'lata'], 'Frijoles': ['1', 'lata'],
        'Cilantro': ['1', 'ramo'], 'Espinaca': ['200', 'gr'],
        'Papa': ['3', 'unidades'], 'Zanahoria': ['2', 'unidades'],
        'Brócoli': ['1', 'taza'], 'Champiñones': ['200', 'gr'],
        'Pimiento': ['1', 'unidad'], 'Berenjena': ['1', 'unidad'],
        'Repollo': ['1/2', 'unidad'], 'Jengibre': ['1', 'trozos'],
        'Ajo': ['3', 'dientes'], 'Limón': ['1', 'unidad'],
        'Arroz': ['1', 'taza'], 'Pasta': ['250', 'gr'],
        'Lechuga': ['1', 'unidad'],
        'Albahaca': ['1/2', 'taza'], 'Aceitunas': ['1/2', 'taza'],
        'Cebolla de verdeo': ['3', 'unidades'],
        'Puerro': ['1', 'unidad'], 'Espárragos': ['200', 'gr'],
        'Batata': ['2', 'unidades'], 'Calabaza': ['300', 'gr'],
        'Lentejas': ['1', 'taza'], 'Quinoa': ['1', 'taza'],
        'Queso': ['200', 'gr'], 'Crema': ['1/2', 'taza'],
        'Anchoas': ['4', 'filetes'], 'Salchicha': ['2', 'unidades']
    };

    const ingredients = selectedIngredients.map(name => {
        const key = Object.keys(qtyMap).find(k => k.toLowerCase() === name);
        if (key) {
            const [qty, unit] = qtyMap[key];
            return { name: capitalize(name), quantity: qty, unit };
        }
        return { name: capitalize(name), quantity: 'al gusto', unit: '' };
    });

    // Add spices/condiments
    const spices = pickN(cuisine.spices, 2);
    spices.forEach(spice => {
        const qty = Math.random() > 0.5 ? { quantity: '2', unit: 'cucharadas' } :
            Math.random() > 0.5 ? { quantity: '1', unit: 'cucharadita' } : { quantity: 'al gusto', unit: '' };
        ingredients.push({ name: spice, ...qty });
    });

    // Add base
    const base = pick(cuisine.bases);
    ingredients.push({ name: base.split(' ')[0], quantity: 'al gusto', unit: '' });

    // Add oil & salt
    ingredients.push({ name: 'Aceite de oliva', quantity: '3', unit: 'cucharadas' });
    ingredients.push({ name: 'Sal', quantity: 'al gusto', unit: '' });
    ingredients.push({ name: 'Pimienta', quantity: 'al gusto', unit: '' });

    // Generate instructions
    const steps = [];
    let stepNum = 0;

    // Prep steps
    const prepItems = ingredients.filter((_, i) => i < Math.min(3, ingredients.length));
    prepItems.forEach(item => {
        if (Math.random() > 0.4) {
            stepNum++;
            const verbs = pickN(ALL_VERBS, 2);
            steps.push(`${verbs[0]} ${item.name.toLowerCase()} en trozos pequeños. ${verbs[1]} y reserva.`);
        }
    });

    // Heat oil
    if (method !== 'hervir' && method !== 'cocer al vapor' && method !== 'pochado') {
        stepNum++;
        steps.push(`Calienta el aceite de oliva en una ${method === 'saltear' ? 'sartén grande' : method === 'estofar' ? 'olla' : 'sartén'} a fuego ${pick(['medio', 'medio-alto', 'medio-bajo'])}.`);
    }

    // Cook main
    stepNum++;
    const mainCooking = method === 'hervir' || method === 'cocer al vapor' || method === 'poche' ? 'Cocina' : 'Sella';
    steps.push(`${mainCooking} ${mainProtein.toLowerCase()} hasta que esté ${pick(['dorado', 'cocido', 'en su punto'])}. Sazona con sal y pimienta.`);

    // Add veggies
    if (veggies.length > 1) {
        stepNum++;
        const vegList = veggies.slice(0, 2).map(v => v.toLowerCase()).join(' y ');
        if (method === 'saltear' || method === 'freír') {
            steps.push(`Agrega ${vegList} y saltéa por ${pick(['3-4', '5', '2-3'])} minutos hasta que estén tiernos.`);
        } else if (method === 'estofar' || method === 'guisar' || method === 'cocinar a fuego lento') {
            steps.push(`Agrega ${vegList} y cocina a fuego lento por ${pick(['10', '15', '20'])} minutos.`);
        } else {
            steps.push(`Agrega ${vegList} y mezcla bien.`);
        }
    }

    // Add spices/sauce
    if (spices.length > 0) {
        stepNum++;
        if (cuisine.id === 'india' || cuisine.id === 'thai') {
            steps.push(`Incorpora ${spices[0].toLowerCase()} y cocina por 1 minuto hasta que suelte aroma.`);
        } else {
            steps.push(`Agrega ${spices[0].toLowerCase()} y mezcla para integrar todos los sabores.`);
        }
    }

    // Simmer/bake
    if (method === 'estofar' || method === 'cocinar a fuego lento' || method === 'guisar') {
        stepNum++;
        steps.push(`Reduce el fuego a bajo, tapa y cocina por ${pick(['20-25', '15-20', '30'])} minutos. Remueve ocasionalmente.`);
    } else if (method === 'hornear') {
        stepNum++;
        steps.push(`Transfiere a una fuente para horno y hornea a 180°C por ${pick(['20-25', '25-30', '35-40'])} minutos.`);
    }

    // Final touches
    stepNum++;
    steps.push(`Prueba y ajusta la sazón con sal y pimienta si es necesario.`);

    stepNum++;
    const servingVerb = pick(['Sirve', 'Emplata', 'Sirve inmediatamente']);
    steps.push(`${servingVerb} caliente${Math.random() > 0.5 ? ', decorado con ' + pick(cuisine.veggies).toLowerCase() + ' fresco' : ''}. ¡Buen provecho!`);

    return {
        title: name,
        tags,
        time: totalTime,
        difficulty,
        image: '',
        ingredients,
        instructions: steps
    };
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function saveAIRecipe(recipeData) {
    if (!checkAuth()) return;

    const ingredientsStr = (recipeData.ingredients || []).map(ing => {
        const qty = ing.quantity || '';
        const unit = ing.unit || '';
        return `${ing.name}|${qty}|${unit}`;
    }).join('\n');

    const stepsStr = (recipeData.instructions || []).join('\n');

    const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800';

    const newRecipe = {
        id: Date.now(),
        name: recipeData.title,
        tags: recipeData.tags || [],
        ingredients: ingredientsStr,
        steps: stepsStr,
        video: '',
        image: recipeData.image || defaultImage,
        time: recipeData.time || 30,
        difficulty: recipeData.difficulty || 'Media',
        isFavorite: false,
        isPublic: false
    };

    recipes.push(newRecipe);
    saveToLocalStorage();
    renderRecipes();
    showToast('Receta guardada en Mis Recetas');
}

// --- Traducciones Español para TheMealDB ---

const esCategories = {
    'Beef': 'Carne de Res', 'Chicken': 'Pollo', 'Dessert': 'Postre',
    'Lamb': 'Cordero', 'Miscellaneous': 'Variado', 'Pasta': 'Pasta',
    'Pork': 'Cerdo', 'Seafood': 'Mariscos', 'Side': 'Acompañamiento',
    'Starter': 'Entrante', 'Vegetarian': 'Vegetariano', 'Breakfast': 'Desayuno',
    'Goat': 'Cabrito', 'Vegan': 'Vegano'
};

const esAreas = {
    'American': 'Estadounidense', 'British': 'Británica', 'Canadian': 'Canadiense',
    'Chinese': 'China', 'Croatian': 'Croata', 'Dutch': 'Holandesa',
    'Egyptian': 'Egipcia', 'French': 'Francesa', 'Greek': 'Griega',
    'Indian': 'India', 'Irish': 'Irlandesa', 'Italian': 'Italiana',
    'Jamaican': 'Jamaiquina', 'Japanese': 'Japonesa', 'Kenyan': 'Keniata',
    'Malaysian': 'Malasia', 'Mexican': 'Mexicana', 'Moroccan': 'Marroquí',
    'Polish': 'Polaca', 'Portuguese': 'Portuguesa', 'Russian': 'Rusa',
    'Spanish': 'Española', 'Thai': 'Tailandesa', 'Tunisian': 'Tunecina',
    'Turkish': 'Turca', 'Vietnamese': 'Vietnamita', 'Unknown': 'Desconocida',
    'Filipino': 'Filipina', 'Ukrainian': 'Ucraniana', 'Uruguayan': 'Uruguaya',
    'Libyan': 'Libia', 'Syrian': 'Siria', 'Saudi Arabian': 'Saudí',
    'Algerian': 'Argelina', 'Sudanese': 'Sudanesa', 'Peruvian': 'Peruana',
    'Brazilian': 'Brasileña', 'Cuban': 'Cubana', 'Honduran': 'Hondureña',
    'Argentinian': 'Argentina', 'Chilean': 'Chilena', 'Colombian': 'Colombiana',
    'Venezuelan': 'Venezolana', 'Ecuadorian': 'Ecuatoriana', 'Dominican': 'Dominicana',
    'Panamanian': 'Panameña', 'Paraguayan': 'Paraguaya', 'Salvadoran': 'Salvadoreña',
    'Guatemalan': 'Guatemalteca', 'Haitian': 'Haitiana', 'Nicaraguan': 'Nicaragüense',
    'Costa Rican': 'Costarricense', 'Bolivian': 'Boliviana', 'Puerto Rican': 'Puertorriqueña'
};

const esIngredients = {
    'chicken': 'pollo', 'chicken breast': 'pechuga de pollo', 'chicken thighs': 'muslos de pollo',
    'chicken legs': 'piernas de pollo', 'chicken wings': 'alas de pollo', 'chicken stock': 'caldo de pollo',
    'chicken broth': 'caldo de pollo', 'chicken liver': 'hígado de pollo', 'beef': 'carne de res',
    'beef steak': 'filete de res', 'beef mince': 'carne molida de res', 'ground beef': 'carne molida',
    'beef fillet': 'filete de res', 'beef brisket': 'pecho de res', 'pork': 'cerdo',
    'pork chops': 'chuletas de cerdo', 'pork tenderloin': 'lomo de cerdo', 'pork belly': 'panceta de cerdo',
    'pork shoulder': 'paleta de cerdo', 'pork ribs': 'costillas de cerdo', 'bacon': 'tocino',
    'ham': 'jamón', 'sausage': 'salchicha', 'lamb': 'cordero', 'lamb leg': 'pierna de cordero',
    'lamb shoulder': 'paleta de cordero', 'lamb chops': 'chuletas de cordero', 'lamb mince': 'carne molida de cordero',
    'duck': 'pato', 'duck legs': 'muslos de pato', 'turkey': 'pavo', 'rabbit': 'conejo',
    'salmon': 'salmón', 'tuna': 'atún', 'cod': 'bacalao', 'trout': 'trucha', 'mackerel': 'caballa',
    'sardines': 'sardinas', 'shrimp': 'camarones', 'prawns': 'langostinos', 'crab': 'cangrejo',
    'lobster': 'langosta', 'mussels': 'mejillones', 'clams': 'almejas', 'oysters': 'ostras',
    'scallops': 'vieiras', 'squid': 'calamar', 'octopus': 'pulpo', 'fish': 'pescado',
    'white fish': 'pescado blanco', 'sea bass': 'lubina', 'red snapper': 'huachinango',
    'egg': 'huevo', 'eggs': 'huevos', 'milk': 'leche', 'butter': 'mantequilla',
    'unsalted butter': 'mantequilla sin sal', 'cream': 'crema de leche', 'heavy cream': 'crema espesa',
    'double cream': 'crema espesa', 'sour cream': 'crema agria', 'yogurt': 'yogur',
    'cheese': 'queso', 'cheddar cheese': 'queso cheddar', 'mozzarella': 'mozzarella',
    'parmesan cheese': 'queso parmesano', 'cream cheese': 'queso crema', 'feta cheese': 'queso feta',
    'goat cheese': 'queso de cabra', 'blue cheese': 'queso azul', 'ricotta': 'ricota',
    'cottage cheese': 'requesón', 'swiss cheese': 'queso suizo', 'gouda': 'gouda',
    'brie': 'brie', 'camembert': 'camembert', 'gruyere': 'gruyere',
    'onion': 'cebolla', 'onions': 'cebollas', 'red onion': 'cebolla morada', 'white onion': 'cebolla blanca',
    'green onion': 'cebolla verde', 'spring onion': 'cebollín', 'shallot': 'chalote',
    'garlic': 'ajo', 'garlic clove': 'diente de ajo', 'garlic cloves': 'dientes de ajo',
    'tomato': 'tomate', 'tomatoes': 'tomates', 'cherry tomatoes': 'tomates cherry',
    'canned tomato': 'tomate enlatado', 'tomato puree': 'puré de tomate', 'tomato paste': 'pasta de tomate',
    'tomato sauce': 'salsa de tomate', 'potato': 'papa', 'potatoes': 'papas',
    'sweet potato': 'batata', 'carrot': 'zanahoria', 'carrots': 'zanahorias',
    'celery': 'apio', 'bell pepper': 'pimiento', 'red bell pepper': 'pimiento rojo',
    'green bell pepper': 'pimiento verde', 'yellow bell pepper': 'pimiento amarillo',
    'cucumber': 'pepino', 'broccoli': 'brócoli', 'cauliflower': 'coliflor',
    'cabbage': 'repollo', 'spinach': 'espinaca', 'lettuce': 'lechuga',
    'kale': 'col rizada', 'arugula': 'rúcula', 'asparagus': 'espárragos',
    'green beans': 'ejotes', 'peas': 'guisantes', 'corn': 'maíz',
    'mushroom': 'champiñón', 'mushrooms': 'champiñones', 'zucchini': 'calabacín',
    'eggplant': 'berenjena', 'avocado': 'aguacate', 'leek': 'puerro',
    'radish': 'rábano', 'beetroot': 'remolacha', 'pumpkin': 'calabaza',
    'butternut squash': 'calabaza moscada', 'artichoke': 'alcachofa',
    'rice': 'arroz', 'white rice': 'arroz blanco', 'brown rice': 'arroz integral',
    'basmati rice': 'arroz basmati', 'jasmine rice': 'arroz jazmín', 'risotto rice': 'arroz para risotto',
    'pasta': 'pasta', 'spaghetti': 'espagueti', 'penne': 'penne', 'lasagne': 'lasaña',
    'lasagna': 'lasaña', 'fettuccine': 'fettuccine', 'linguine': 'linguine',
    'macaroni': 'macarrones', 'tagliatelle': 'tagliatelle', 'noodles': 'tallarines',
    'rice noodles': 'tallarines de arroz', 'egg noodles': 'tallarines de huevo',
    'bread': 'pan', 'breadcrumbs': 'pan rallado', 'flour': 'harina',
    'plain flour': 'harina de trigo', 'all-purpose flour': 'harina de trigo',
    'self-raising flour': 'harina leudante', 'cornflour': 'maicena', 'corn starch': 'maicena',
    'sugar': 'azúcar', 'white sugar': 'azúcar blanca', 'brown sugar': 'azúcar morena',
    'powdered sugar': 'azúcar glass', 'icing sugar': 'azúcar glass', 'honey': 'miel',
    'maple syrup': 'jarabe de arce', 'chocolate': 'chocolate', 'dark chocolate': 'chocolate oscuro',
    'milk chocolate': 'chocolate con leche', 'white chocolate': 'chocolate blanco',
    'cocoa powder': 'cacao en polvo', 'vanilla': 'vainilla', 'vanilla extract': 'extracto de vainilla',
    'vanilla essence': 'esencia de vainilla', 'olive oil': 'aceite de oliva',
    'vegetable oil': 'aceite vegetal', 'sunflower oil': 'aceite de girasol', 'sesame oil': 'aceite de ajonjolí',
    'coconut oil': 'aceite de coco', 'salt': 'sal', 'sea salt': 'sal marina',
    'black pepper': 'pimienta negra', 'white pepper': 'pimienta blanca', 'pepper': 'pimienta',
    'soy sauce': 'salsa de soya', 'vinegar': 'vinagre', 'balsamic vinegar': 'vinagre balsámico',
    'red wine vinegar': 'vinagre de vino tinto', 'white wine vinegar': 'vinagre de vino blanco',
    'lemon': 'limón', 'lemon juice': 'jugo de limón', 'lemon zest': 'ralladura de limón',
    'lime': 'lima', 'lime juice': 'jugo de lima', 'orange': 'naranja',
    'orange juice': 'jugo de naranja', 'orange zest': 'ralladura de naranja',
    'apple': 'manzana', 'banana': 'plátano', 'strawberry': 'fresa', 'strawberries': 'fresas',
    'blueberry': 'arándano', 'blueberries': 'arándanos', 'raspberry': 'frambuesa',
    'raspberries': 'frambuesas', 'blackberry': 'mora', 'blackberries': 'moras',
    'pineapple': 'piña', 'mango': 'mango', 'peach': 'durazno', 'pear': 'pera',
    'watermelon': 'sandía', 'grapes': 'uvas', 'raisins': 'pasas', 'coconut': 'coco',
    'almond': 'almendra', 'almonds': 'almendras', 'walnuts': 'nueces', 'pecans': 'pacanas',
    'peanuts': 'cacahuates', 'peanut butter': 'mantequilla de cacahuate',
    'cashew nuts': 'anacardos', 'pine nuts': 'piñones', 'hazelnuts': 'avellanas',
    'ginger': 'jengibre', 'fresh ginger': 'jengibre fresco', 'turmeric': 'cúrcuma',
    'cinnamon': 'canela', 'cumin': 'comino', 'paprika': 'pimentón', 'chili': 'chile',
    'chili powder': 'chile en polvo', 'chili flakes': 'hojuelas de chile',
    'oregano': 'orégano', 'basil': 'albahaca', 'parsley': 'perejil', 'cilantro': 'cilantro',
    'coriander': 'cilantro', 'mint': 'menta', 'rosemary': 'romero', 'thyme': 'tomillo',
    'bay leaf': 'hoja de laurel', 'bay leaves': 'hojas de laurel', 'sage': 'salvia',
    'dill': 'eneldo', 'nutmeg': 'nuez moscada', 'clove': 'clavo', 'cardamom': 'cardamomo',
    'allspice': 'pimienta gorda', 'mustard': 'mostaza', 'dijon mustard': 'mostaza dijon',
    'wholegrain mustard': 'mostaza en grano', 'mayonnaise': 'mayonesa', 'ketchup': 'salsa de tomate',
    'worcestershire sauce': 'salsa inglesa', 'fish sauce': 'salsa de pescado',
    'hoisin sauce': 'salsa hoisin', 'oyster sauce': 'salsa de ostión',
    'mixed herbs': 'hierbas mixtas', 'italian seasoning': 'hierbas italianas',
    'curry powder': 'polvo de curry', 'curry paste': 'pasta de curry',
    'coconut milk': 'leche de coco', 'cream of mushroom': 'crema de champiñones',
    'cream of chicken': 'crema de pollo', 'gelatin': 'gelatina', 'yeast': 'levadura',
    'baking powder': 'polvo de hornear', 'baking soda': 'bicarbonato de sodio',
    'stock': 'caldo', 'beef stock': 'caldo de res', 'vegetable stock': 'caldo de verduras',
    'fish stock': 'caldo de pescado', 'white wine': 'vino blanco', 'red wine': 'vino tinto',
    'beer': 'cerveza', 'cider': 'sidra', 'rum': 'ron', 'brandy': 'brandy',
    'water': 'agua', 'ice': 'hielo', 'ice cream': 'helado',
    'couscous': 'cuscús', 'quinoa': 'quinoa', 'lentils': 'lentejas', 'chickpeas': 'garbanzos',
    'beans': 'frijoles', 'black beans': 'frijoles negros', 'kidney beans': 'frijoles rojos',
    'green lentils': 'lentejas verdes', 'red lentils': 'lentejas rojas',
    'tofu': 'tofu', 'olives': 'aceitunas', 'black olives': 'aceitunas negras',
    'green olives': 'aceitunas verdes', 'capers': 'alcaparras', 'pickles': 'pepinillos',
    'sesame seeds': 'semillas de ajonjolí', 'sunflower seeds': 'semillas de girasol',
    'poppy seeds': 'semillas de amapola', 'chia seeds': 'semillas de chía',
    'flax seeds': 'semillas de lino', 'mixed spice': 'especias mixtas',
    'five spice powder': 'polvo de cinco especias', 'garam masala': 'garam masala',
    'thai green curry paste': 'pasta de curry verde tailandés', 'thai red curry paste': 'pasta de curry rojo tailandés',
    'sriracha': 'sriracha', 'tabasco': 'tabasco', 'horseradish': 'rábano picante',
    'mascarpone': 'mascarpone', 'pesto': 'pesto', 'hummus': 'hummus',
    'tahini': 'tahini', 'molasses': 'melaza', 'golden syrup': 'jarabe dorado',
    'corn syrup': 'jarabe de maíz', 'jam': 'mermelada', 'marmalade': 'mermelada de naranja',
    'yeast extract': 'extracto de levadura', 'miso': 'miso', 'nori': 'nori',
    'wasabi': 'wasabi', 'rice vinegar': 'vinagre de arroz', 'mirin': 'mirin',
    'sake': 'sake', 'sushi rice': 'arroz para sushi',
    'baby spinach': 'espinaca baby', 'mixed vegetables': 'verduras mixtas',
    'frozen peas': 'guisantes congelados', 'french lentils': 'lentejas francesas',
    'puy lentils': 'lentejas puy', 'buckwheat': 'trigo sarraceno', 'polenta': 'polenta',
    'bulgar wheat': 'trigo bulgar', 'semolina': 'sémola', 'cornmeal': 'harina de maíz',
    'oat': 'avena', 'oats': 'avena', 'porridge oats': 'avena para porridge',
    'granola': 'granola', 'cereal': 'cereal', 'panko breadcrumbs': 'pan rallado panko',
    'tortillas': 'tortillas', 'pitta bread': 'pan pita', 'naan bread': 'pan naan',
    'baguette': 'baguette', 'sourdough': 'pan de masa madre', 'ciabatta': 'ciabatta',
    'wrap': 'wrap', 'filo pastry': 'masa filo', 'puff pastry': 'masa de hojaldre',
    'shortcrust pastry': 'masa quebrada', 'suet': 'grasa de res',
    'dates': 'dátiles', 'dried apricots': 'orejones', 'prunes': 'ciruelas pasas',
    'figs': 'higos', 'rhubarb': 'ruibarbo', 'cranberries': 'arándanos rojos',
    'cherries': 'cerezas', 'pomegranate': 'granada', 'passion fruit': 'maracuyá',
    'papaya': 'papaya', 'guava': 'guayaba', 'plantain': 'plátano macho',
    'cassava': 'mandioca', 'yam': 'ñame', 'taro': 'taro',
    'edamame': 'edamame', 'bean sprouts': 'brotes de soya',
    'water chestnuts': 'castañas de agua', 'bamboo shoots': 'brotes de bambú',
    'chinese cabbage': 'repollo chino', 'bok choy': 'bok choy',
    'egg roll wrappers': 'envolturas para rollitos', 'wonton wrappers': 'envolturas para wantán',
    'rice paper': 'papel de arroz', 'vermicelli noodles': 'fideos de arroz',
    'udon noodles': 'tallarines udon', 'soba noodles': 'tallarines soba',
    'sweet chili sauce': 'salsa de chile dulce', 'gochujang': 'gochujang',
    'mango chutney': 'chutney de mango', 'lime pickle': 'encurtido de lima',
    'popcorn': 'palomitas', 'pretzels': 'pretzels', 'crackers': 'galletas saladas',
    'gravy': 'salsa gravy', 'brown sauce': 'salsa marrón', 'hp sauce': 'salsa HP',
    'marmite': 'marmite', 'vegemite': 'vegemite',
    'corned beef': 'carne enlatada', 'spam': 'spam',
    'smoked paprika': 'pimentón ahumado', 'saffron': 'azafrán', 'truffle oil': 'aceite de trufa',
    'rose water': 'agua de rosas', 'orange blossom water': 'agua de azahar',
    'pomegranate molasses': 'melaza de granada', 'sumac': 'zumaque',
    'zaatar': 'zaatar', 'harissa': 'harissa', 'baharat': 'baharat',
    'ras el hanout': 'ras el hanout', 'tahini paste': 'pasta de tahini',
    'haloumi': 'haloumi', 'halloumi': 'halloumi',
    'mincemeat': 'carne picada', 'toast': 'pan tostado', 'croutons': 'crutones',
    'mixed grain': 'granos mixtos', 'wild rice': 'arroz salvaje'
};

const esCommon = {
    'and': 'y', 'with': 'con', 'in': 'en', 'of': 'de', 'the': 'el', 'a': 'un',
    'an': 'una', 'for': 'para', 'or': 'o', 'to': 'a', 'from': 'de', 'by': 'por',
    'on': 'en', 'at': 'en', 'is': 'es', 'are': 'son', 'serve': 'servir',
    'serves': 'rinde', 'makes': 'hace', 'make': 'hacer', 'prep': 'preparación',
    'cook': 'cocinar', 'cooking': 'cocción', 'bake': 'hornear', 'baked': 'horneado',
    'roast': 'asar', 'roasted': 'asado', 'grill': 'asar a la parrilla',
    'grilled': 'a la parrilla', 'fry': 'freír', 'fried': 'frito', 'boil': 'hervir',
    'boiled': 'hervido', 'steam': 'vapor', 'steamed': 'al vapor', 'stir': 'revolver',
    'mix': 'mezclar', 'mixed': 'mixto', 'add': 'agregar', 'added': 'agregado',
    'place': 'colocar', 'put': 'poner', 'remove': 'retirar', 'set': 'colocar',
    'cover': 'cubrir', 'uncover': 'descubrir', 'heat': 'calentar', 'preheat': 'precalentar',
    'medium': 'medio', 'low': 'bajo', 'high': 'alto', 'large': 'grande',
    'small': 'pequeño', 'fresh': 'fresco', 'dried': 'seco', 'frozen': 'congelado',
    'canned': 'enlatado', 'minced': 'picado', 'chopped': 'picado', 'diced': 'en cubos',
    'sliced': 'en rodajas', 'grated': 'rallado', 'mashed': 'hecho puré',
    'whole': 'entero', 'ground': 'molido', 'powder': 'polvo', 'pinch': 'pizca',
    'tablespoon': 'cucharada', 'tablespoons': 'cucharadas', 'teaspoon': 'cucharadita',
    'teaspoons': 'cucharaditas', 'cup': 'taza', 'cups': 'tazas', 'ounce': 'onza',
    'ounces': 'onzas', 'pound': 'libra', 'pounds': 'libras', 'piece': 'pieza',
    'pieces': 'piezas', 'leaf': 'hoja', 'leaves': 'hojas', 'slice': 'rebanada',
    'slices': 'rebanadas', 'clove': 'diente', 'cloves': 'dientes',
    'inch': 'pulgada', 'inches': 'pulgadas', 'ml': 'ml', 'g': 'g', 'kg': 'kg',
    'optional': 'opcional', 'to taste': 'al gusto', 'salt and pepper': 'sal y pimienta',
    'oil': 'aceite', 'water': 'agua', 'sauce': 'salsa', 'soup': 'sopa',
    'salad': 'ensalada', 'stew': 'estofado', 'pie': 'pastel', 'cake': 'pastel',
    'bread': 'pan', 'smoothie': 'batido', 'juice': 'jugo', 'skewer': 'brocheta',
    'skewers': 'brochetas', 'tray': 'bandeja', 'pan': 'sartén', 'pot': 'olla',
    'oven': 'horno', 'microwave': 'microondas', 'fridge': 'nevera', 'freezer': 'congelador',
    'minute': 'minuto', 'minutes': 'minutos', 'hour': 'hora', 'hours': 'horas',
    'hour and': 'hora y', 'until': 'hasta', 'golden': 'dorado', 'brown': 'dorar',
    'tender': 'tierno', 'soft': 'suave', 'warm': 'templado', 'hot': 'caliente',
    'cold': 'frío', 'room temperature': 'temperatura ambiente', 'refrigerate': 'refrigerar',
    'chill': 'enfriar', 'cool': 'enfriar', 'drain': 'escurrir', 'drained': 'escurrido',
    'rinse': 'enjuagar', 'wash': 'lavar', 'peel': 'pelar', 'peeled': 'pelado',
    'cut': 'cortar', 'cutting': 'corte', 'divide': 'dividir', 'spread': 'untar',
    'brush': 'untar', 'pour': 'verter', 'sprinkle': 'espolvorear', 'season': 'sazonar',
    'seasoned': 'sazonado', 'dust': 'espolvorear', 'coat': 'cubrir', 'reserve': 'reservar',
    'return': 'devolver', 'repeat': 'repetir', 'process': 'procesar', 'blend': 'licuar',
    'whisk': 'batir', 'beat': 'batir', 'stirring': 'revolviendo', 'shake': 'agitar',
    'roll': 'enrollar', 'rolled': 'enrollado', 'wrap': 'envolver', 'unwrap': 'desenvolver',
    'stuff': 'rellenar', 'stuffed': 'relleno', 'fill': 'rellenar', 'filled': 'relleno',
    'serve immediately': 'servir inmediatamente', 'enjoy': 'disfrutar',
    'tip': 'consejo', 'tips': 'consejos', 'variation': 'variación',
    'gluten free': 'sin gluten', 'dairy free': 'sin lácteos', 'low fat': 'bajo en grasa',
    'note': 'nota', 'notes': 'notas', 'preparation': 'preparación',
    'instruction': 'instrucción', 'method': 'método', 'directions': 'instrucciones',
    'ingredients': 'ingredientes', 'step': 'paso', 'steps': 'pasos'
};

const esAllDict = { ...esIngredients, ...esCategories, ...esAreas, ...esCommon };

function esTrans(word, dict) {
    const lower = word.toLowerCase().trim();
    return dict[lower] || word;
}

function translateIngredientName(name) {
    return esTrans(name, esIngredients);
}

function translateCategory(name) {
    return esTrans(name, esCategories);
}

function translateArea(name) {
    return esTrans(name, esAreas);
}

function translateText(text) {
    if (!text) return text;
    const words = text.split(/(\s+|(?=[.,;:!?()¿¡]))/);
    return words.map(w => {
        if (/^[\s.,;:!?()¿¡]+$/.test(w) || !w.trim()) return w;
        const translated = esTrans(w, esAllDict);
        if (translated !== w.toLowerCase().trim()) {
            if (w[0] === w[0]?.toUpperCase() && translated.length > 0) {
                return translated.charAt(0).toUpperCase() + translated.slice(1);
            }
            return translated;
        }
        return w;
    }).join('');
}

// --- TheMealDB (Explorar Recetas) ---

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1/';
let currentExploreRecipe = null;

async function mealdbFetch(endpoint) {
    const res = await fetch(MEALDB_BASE + endpoint);
    if (!res.ok) throw new Error('Error al conectar con TheMealDB');
    return res.json();
}

function mealdbToAppRecipe(meal) {
    const ingredients = [];
    const seen = new Set();
    for (let i = 1; i <= 20; i++) {
        const name = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (!name || !name.trim()) break;
        const key = name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ingredients.push({
            name: translateIngredientName(name.trim()),
            quantity: measure ? measure.trim() : 'al gusto',
            unit: ''
        });
    }

    let steps = (meal.strInstructions || '').trim();
    steps = steps.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    steps = steps.split('\n').filter(s => s.trim()).map((s, i) => {
        const clean = s.replace(/^\d+[\.\)]\s*/, '').trim();
        return `Paso ${i + 1}: ${translateText(clean)}`;
    });

    const tags = [];
    if (meal.strCategory) tags.push(translateCategory(meal.strCategory));
    if (meal.strArea) tags.push(translateArea(meal.strArea));
    if (meal.strTags) {
        meal.strTags.split(',').forEach(t => {
            const tt = t.trim();
            if (tt && !tags.includes(tt)) tags.push(translateText(tt));
        });
    }

    const area = meal.strArea ? translateArea(meal.strArea) : '';
    const category = meal.strCategory ? translateCategory(meal.strCategory) : '';

    return {
        idMeal: meal.idMeal,
        title: translateText(meal.strMeal || 'Sin nombre'),
        tags: tags.length > 0 ? tags : ['Internacional'],
        category,
        area,
        time: 45,
        difficulty: 'Media',
        image: meal.strMealThumb || '',
        video: meal.strYoutube || '',
        ingredients,
        instructions: steps
    };
}

function renderExploreResults(meals, append = false) {
    if (!append) exploreGrid.innerHTML = '';
    if (!meals || meals.length === 0) {
        exploreGrid.innerHTML = '<div class="no-recipes"><span class="material-icons">search_off</span><p>No se encontraron recetas</p></div>';
        return;
    }
    meals.forEach(meal => {
        const r = mealdbToAppRecipe(meal);
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
            <div class="recipe-card-img-container">
                <img src="${r.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="recipe-img" alt="${escapeHtml(r.title)}" loading="lazy">
                ${r.area ? `<div class="author-badge"><span class="material-icons">public</span> ${escapeHtml(r.area)}</div>` : ''}
            </div>
            <div class="recipe-info">
                <div class="recipe-tags">${r.tags.slice(0, 2).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
                <h3>${escapeHtml(r.title)}</h3>
                <div class="recipe-meta">
                    <span><span class="material-icons">schedule</span> ${r.time} min</span>
                    <span><span class="material-icons">bar_chart</span> ${r.difficulty}</span>
                </div>
            </div>
        `;
        card.onclick = () => showExploreRecipe(r);
        exploreGrid.appendChild(card);
    });
}

function showExploreRecipe(recipe) {
    currentExploreRecipe = recipe;
    const tagsHtml = (recipe.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const ingredientsHtml = (recipe.ingredients || []).map(ing =>
        `<div class="ingredient-item">
            <span class="ingredient-name">${escapeHtml(ing.name)}</span>
            <span class="ingredient-qty">${escapeHtml(ing.quantity)} ${escapeHtml(ing.unit || '')}</span>
        </div>`
    ).join('');
    const stepsHtml = (recipe.instructions || []).map(s => `<div class="ai-step">${escapeHtml(s)}</div>`).join('');

    const embedUrl = getYoutubeEmbedUrl(recipe.video);

    exploreDetails.innerHTML = `
        <div class="detail-body">
            <div class="detail-hero">
                <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" alt="${escapeHtml(recipe.title)}">
                <div class="detail-hero-overlay"></div>
            </div>
            <div class="detail-content">
                <div class="detail-header-info">
                    <div class="recipe-tags" style="margin-bottom: 1rem;">${tagsHtml}</div>
                    <h1>${escapeHtml(recipe.title)}</h1>
                    <div class="detail-meta-row">
                        <span><span class="material-icons">schedule</span> ${recipe.time || '--'} min</span>
                        <span><span class="material-icons">bar_chart</span> ${recipe.difficulty || 'Media'}</span>
                    </div>
                </div>
                <div class="detail-section">
                    <h3 class="detail-section-title">Ingredientes</h3>
                    <div class="detail-ingredients">${ingredientsHtml}</div>
                </div>
                <div class="detail-section">
                    <h3 class="detail-section-title">Preparación</h3>
                    <div class="detail-steps">${stepsHtml}</div>
                </div>
                ${embedUrl ? `
                    <div class="detail-section">
                        <h3 class="detail-section-title">Video Tutorial</h3>
                        <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 20px; border: 1px solid var(--border-color);">
                            <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allowfullscreen></iframe>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    exploreModal.style.display = 'block';
}

function saveExploreRecipe() {
    if (!checkAuth()) return;
    if (!currentExploreRecipe) return;

    const ingredientsStr = (currentExploreRecipe.ingredients || []).map(ing =>
        `${ing.name}|${ing.quantity}|${ing.unit}`
    ).join('\n');
    const stepsStr = (currentExploreRecipe.instructions || []).join('\n');

    const newRecipe = {
        id: Date.now(),
        name: currentExploreRecipe.title,
        tags: currentExploreRecipe.tags || [],
        ingredients: ingredientsStr,
        steps: stepsStr,
        video: currentExploreRecipe.video || '',
        image: currentExploreRecipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800',
        time: currentExploreRecipe.time || 45,
        difficulty: currentExploreRecipe.difficulty || 'Media',
        isFavorite: false,
        isPublic: false
    };

    recipes.push(newRecipe);
    saveToLocalStorage();
    renderRecipes();
    exploreModal.style.display = 'none';
    showToast('Receta guardada en Mis Recetas');
}

async function searchExplore(query) {
    exploreGrid.innerHTML = '';
    exploreStatus.textContent = 'Buscando...';
    try {
        const data = await mealdbFetch(`search.php?s=${encodeURIComponent(query)}`);
        let meals = data.meals || [];
        // Also search by ingredient if name search returns few results
        if (meals.length < 5) {
            const data2 = await mealdbFetch(`filter.php?i=${encodeURIComponent(query)}`);
            if (data2.meals) {
                const ids = new Set(meals.map(m => m.idMeal));
                const details = await Promise.all(
                    data2.meals.slice(0, 10).map(m => mealdbFetch(`lookup.php?i=${m.idMeal}`))
                );
                details.forEach(d => {
                    if (d.meals && d.meals[0] && !ids.has(d.meals[0].idMeal)) {
                        meals.push(d.meals[0]);
                        ids.add(d.meals[0].idMeal);
                    }
                });
            }
        }
        exploreStatus.textContent = meals.length > 0 ? `${meals.length} receta(s) encontrada(s)` : '';
        renderExploreResults(meals);
    } catch (e) {
        exploreStatus.textContent = 'Error al buscar. Intenta de nuevo.';
    }
}

async function loadExploreChips(type) {
    const param = type === 'categories' ? 'c' : 'a';
    exploreSubchips.innerHTML = '<span class="explore-loading">Cargando...</span>';
    try {
        const data = await mealdbFetch(`list.php?${param}=list`);
        const items = data.meals || [];
        exploreSubchips.innerHTML = items.map(item => {
            const original = type === 'categories' ? item.strCategory : item.strArea;
            const translated = type === 'categories' ? translateCategory(original) : translateArea(original);
            return `<button class="explore-subchip" data-type="${type}" data-value="${escapeHtml(original)}">${escapeHtml(translated)}</button>`;
        }).join('');
    } catch (e) {
        exploreSubchips.innerHTML = '<span style="opacity:0.6;">Error al cargar</span>';
    }
}

async function filterExplore(type, value) {
    exploreGrid.innerHTML = '';
    exploreStatus.textContent = 'Cargando...';
    const param = type === 'categories' ? 'c' : 'a';
    try {
        const data = await mealdbFetch(`filter.php?${param}=${encodeURIComponent(value)}`);
        const ids = (data.meals || []).slice(0, 12).map(m => m.idMeal);
        const details = await Promise.all(ids.map(id => mealdbFetch(`lookup.php?i=${id}`)));
        const meals = details.map(d => d.meals?.[0]).filter(Boolean);
        exploreStatus.textContent = meals.length > 0 ? `${meals.length} receta(s)` : '';
        renderExploreResults(meals);
    } catch (e) {
        exploreStatus.textContent = 'Error al cargar. Intenta de nuevo.';
    }
}

async function getRandomExplore() {
    exploreGrid.innerHTML = '';
    exploreStatus.textContent = 'Buscando receta aleatoria...';
    try {
        const data = await mealdbFetch('random.php');
        const meals = data.meals || [];
        exploreStatus.textContent = '';
        renderExploreResults(meals);
    } catch (e) {
        exploreStatus.textContent = 'Error al obtener receta. Intenta de nuevo.';
    }
}

function renderTagsManager() {
    const container = document.getElementById('tags-list-container');
    container.innerHTML = userTags.map((tag, i) => `
        <div class="tag-manager-item">
            <span class="tag-manager-item-name">${tag}</span>
            <div class="tag-manager-actions">
                <button class="btn-icon" onclick="editTag(${i})"><span class="material-icons">edit</span></button>
                 <button class="btn-icon" style="color: #ef4444;" onclick="deleteTag(${i})"><span class="material-icons">delete</span></button>
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
            time: parseInt(data.time) || 30,
            difficulty: ['Fácil', 'Media', 'Difícil'].includes(data.difficulty) ? data.difficulty : 'Media',
            isFavorite: false,
            isPublic: data.isPublic === true || data.isPublic === 'true'
        };
        recipes.push(newRecipe);
        saveToLocalStorage();
        renderRecipes();
        importModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        showToast('Importado con éxito');
    } catch (e) {
        importError.textContent = 'JSON no válido';
        importError.style.display = 'block';
    }
}

let plannerViewMode = localStorage.getItem('gusto_planner_view') || 'meals';

function setPlannerView(mode) {
    plannerViewMode = mode;
    localStorage.setItem('gusto_planner_view', mode);
    document.querySelectorAll('.planner-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    renderWeeklyPlanner();
}

function renderWeeklyPlanner() {
    document.querySelectorAll('.planner-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === plannerViewMode);
    });
    if (plannerViewMode === 'day') {
        renderWeeklyPlannerByDay();
    } else {
        renderWeeklyPlannerByMeals();
    }
}

function renderWeeklyPlannerByMeals() {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    plannerGrid.innerHTML = '';

    days.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'planner-day';

        const dayMeals = plannerData[day] || {};
        let mealsHtml = '';
        MEALS.forEach(meal => {
            const recipeIds = dayMeals[meal] || [];
            const recipesHtml = recipeIds.map(id => {
                const r = recipes.find(rec => rec.id === id);
                return r ? `<div class="planner-recipe">
                    <span>${r.name}</span>
                    <button class="btn-icon circle-sm danger" onclick="removeFromPlanner('${day}', '${meal}', ${id})"><span class="material-icons">close</span></button>
                </div>` : '';
            }).join('');

            mealsHtml += `
                <div class="planner-meal-section">
                    <h4 class="planner-meal-title">${meal}</h4>
                    ${recipesHtml || `<p class="planner-empty-meal">—</p>`}
                    <div class="planner-slot" onclick="openPlannerSelector('${day}', '${meal}')">
                        <span class="material-icons">add</span>
                        <span>Añadir</span>
                    </div>
                </div>
            `;
        });

        dayDiv.innerHTML = `<h3>${day}</h3>${mealsHtml}`;
        plannerGrid.appendChild(dayDiv);
    });
}

function renderWeeklyPlannerByDay() {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    plannerGrid.innerHTML = '';

    days.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'planner-day';

        const dayMeals = plannerData[day] || {};
        const allIds = [];
        MEALS.forEach(meal => {
            (dayMeals[meal] || []).forEach(id => {
                if (!allIds.includes(id)) allIds.push(id);
            });
        });

        const recipesHtml = allIds.map(id => {
            const r = recipes.find(rec => rec.id === id);
            return r ? `<div class="planner-recipe">
                <span>${r.name}</span>
                <button class="btn-icon circle-sm danger" onclick="removeFromPlannerAnyMeal('${day}', ${id})"><span class="material-icons">close</span></button>
            </div>` : '';
        }).join('');

        dayDiv.innerHTML = `
            <h3>${day}</h3>
            ${recipesHtml || `<p class="planner-empty-meal" style="margin-bottom:0.75rem;">Sin recetas</p>`}
            <div class="planner-slot" onclick="openPlannerSelector('${day}', 'Almuerzo')">
                <span class="material-icons">add</span>
                <span>Añadir receta</span>
            </div>
        `;
        plannerGrid.appendChild(dayDiv);
    });
}

function removeFromPlannerAnyMeal(day, id) {
    const meals = plannerData[day] || {};
    MEALS.forEach(meal => {
        meals[meal] = (meals[meal] || []).filter(rid => rid !== id);
    });
    savePlannerData();
    renderWeeklyPlanner();
}

function openPlannerSelector(day, meal) {
    activePlannerDay = day;
    activePlannerMeal = meal;
    document.getElementById('planner-day-name').textContent = plannerViewMode === 'day' ? day : day + ' — ' + meal;
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
             <span class="material-icons" style="font-size: 1.5rem;">add_circle_outline</span>
        `;
        item.onclick = () => {
            if (!plannerData[activePlannerDay]) {
                plannerData[activePlannerDay] = {};
                MEALS.forEach(m => { plannerData[activePlannerDay][m] = []; });
            }
            const mealArr = plannerData[activePlannerDay][activePlannerMeal];
            if (mealArr && !mealArr.includes(r.id)) {
                mealArr.push(r.id);
            }
            savePlannerData();
            renderWeeklyPlanner();
            document.getElementById('planner-modal').style.display = 'none';
        };
        listContainer.appendChild(item);
    });
}

function removeFromPlanner(day, meal, id) {
    const meals = plannerData[day] || {};
    const arr = meals[meal] || [];
    meals[meal] = arr.filter(rid => rid !== id);
    savePlannerData();
    renderWeeklyPlanner();
}

function savePlannerData() {
    localStorage.setItem('gusto_planner', JSON.stringify(plannerData));
    if (auth.currentUser && db) {
        db.ref(`users/${auth.currentUser.uid}/planner`).set(plannerData)
            .catch(err => console.error('Error sync planificador:', err));
    }
}

function renderShoppingList() {
    shoppingContent.innerHTML = '';
    const ingredientMap = {};

    const allIds = [];
    Object.values(plannerData).forEach(dayMeals => {
        if (!dayMeals) return;
        MEALS.forEach(meal => {
            (dayMeals[meal] || []).forEach(id => allIds.push(id));
        });
    });

    allIds.forEach(id => {
        const r = recipes.find(rec => rec.id === id);
        if (r && r.ingredients) {
            r.ingredients.split('\n').filter(i => i.trim()).forEach(i => {
                const parts = i.trim().split('|').map(p => p.trim());
                const name = (parts[0] || '').toLowerCase();
                if (!name) return;
                const cantidad = parts[1] || '';
                const unidad = (parts[2] || '').toLowerCase();

                const key = name + '|' + unidad;
                if (!ingredientMap[name]) {
                    ingredientMap[name] = { displayName: parts[0], units: {}, recipeCount: 0, recipesSet: new Set() };
                }
                ingredientMap[name].recipesSet.add(id);
                if (!ingredientMap[name].units[unidad]) {
                    ingredientMap[name].units[unidad] = { total: 0, textParts: [] };
                }

                // Try to parse number
                const numMatch = cantidad.match(/^(\d+\.?\d*)\s*(.*)/);
                if (numMatch) {
                    ingredientMap[name].units[unidad].total += parseFloat(numMatch[1]);
                    if (numMatch[2]) {
                        const suffix = numMatch[2].trim();
                        if (suffix && !unidad) {
                            ingredientMap[name].units[unidad].textParts.push(suffix);
                        }
                    }
                } else if (cantidad) {
                    ingredientMap[name].units[unidad].textParts.push(cantidad);
                }
            });
        }
    });

    const entries = Object.values(ingredientMap);
    if (entries.length === 0) {
        shoppingContent.innerHTML = '<p class="no-recipes">Añade recetas al planificador para ver tu lista de compras.</p>';
        return;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'shopping-header';
    header.innerHTML = `<span>Ingrediente</span><span>Cantidad Total</span>`;
    shoppingContent.appendChild(header);

    entries.sort((a, b) => a.displayName.localeCompare(b.displayName)).forEach(ing => {
        const displayName = ing.displayName.charAt(0).toUpperCase() + ing.displayName.slice(1);
        const recipeCount = ing.recipesSet.size;
        const recipeLabel = recipeCount > 1 ? `<span class="recipe-count-label">de ${recipeCount} recetas</span>` : '';
        const unitEntries = Object.entries(ing.units);
        let cantidadHtml = '';

        if (unitEntries.length === 1 && unitEntries[0][0] === '') {
            // No unit specified
            const data = unitEntries[0][1];
            if (data.total > 0) {
                cantidadHtml = `<span class="shopping-qty">${data.total}</span>`;
            }
            const textQty = data.textParts.filter(Boolean).join(', ');
            if (textQty) {
                cantidadHtml += cantidadHtml ? `<span class="shopping-detail">${textQty}</span>` : `<span class="shopping-detail">${textQty}</span>`;
            }
        } else {
            cantidadHtml = unitEntries.map(([unidad, data]) => {
                let part = '';
                if (data.total > 0) {
                    part = `${data.total}`;
                    if (unidad) part += ` ${unidad}`;
                }
                const textQty = data.textParts.filter(Boolean).join(', ');
                if (textQty) {
                    part = part ? `${part}, ${textQty}` : textQty;
                }
                return part;
            }).filter(Boolean).join(' + ');
        }

        const div = document.createElement('div');
        div.className = 'shopping-item';
         div.innerHTML = `<span class="shopping-name">${displayName}${recipeLabel}</span><span class="shopping-qty-cell">${cantidadHtml}</span><span class="material-icons" style="color: var(--primary);">check_circle_outline</span>`;
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
                        ${recipe.video ? `<a href="${recipe.video}" target="_blank" class="cook-video-link"><span class="material-icons">smart_display</span> Ver Video Tutorial</a>` : ''}
                    </div>
                </div>
                <button class="btn-close-circle" onclick="document.getElementById('cook-overlay').style.display='none'"><span class="material-icons">close</span></button>
            </header>

            <div class="cook-ingredients">
                <h2 class="cook-col-title">INGREDIENTES <span>(Toca para marcar)</span></h2>
                <ul class="checklist">
                    ${recipe.ingredients.split('\n').filter(i => i.trim()).map(i => `<li onclick="this.classList.toggle('checked')">${renderIngredientLine(i.trim())}</li>`).join('')}
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
