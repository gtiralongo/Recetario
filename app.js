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

// Tag Dropdowns
const tagContainers = [document.getElementById('tag-dropdown-desktop'), document.getElementById('tag-dropdown-mobile')];
const tagOptionsLists = [document.getElementById('tag-options-desktop'), document.getElementById('tag-options-mobile')];
const tagLabels = [document.getElementById('current-tag-label-desktop')];
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

let plannerData = JSON.parse(localStorage.getItem('gusto_planner')) || {};

// --- Initialization ---

async function init() {
    try {
        if (auth) {
            await loadData();
            setupEventListeners();
            switchView('home');
            renderRandomRecipes();
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
            isFavorite: false,
            isPublic: false
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
                 <button class="btn-icon circle-sm danger" onclick="removeFromPlanner('${day}', ${id})"><span class="material-icons">close</span></button>
            </div>` : '';
        }).join('');

        dayDiv.innerHTML = `
            <h3>${day}</h3>
            ${plannedRecipes}
            <div class="planner-slot" onclick="openPlannerSelector('${day}')">
                 <span class="material-icons">add</span>
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
             <span class="material-icons" style="font-size: 1.5rem;">add_circle_outline</span>
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
    const ingredientMap = {};

    Object.values(plannerData).flat().forEach(id => {
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

// Kickstart
init();
