// SW Cleanup / Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) registration.unregister();
    });
}

// Recipe Data Management
let recipes = [];
let currentCategory = 'all';
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
const deleteCurrentBtn = document.getElementById('delete-current-btn');
const editCurrentBtn = document.getElementById('edit-current-btn');
const favoriteCurrentBtn = document.getElementById('favorite-current-btn');

// Modals
const recipeModal = document.getElementById('recipe-modal');
const viewModal = document.getElementById('view-modal');
const recipeForm = document.getElementById('recipe-form');
const addBtn = document.getElementById('add-recipe-btn');
const importBtn = document.getElementById('import-json-btn');
const closeBtns = document.querySelectorAll('.close-modal');
const importModal = document.getElementById('import-modal');
const processJsonBtn = document.getElementById('process-json-btn');
const jsonInput = document.getElementById('json-input');
const importError = document.getElementById('import-error');

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
    await loadRecipes();
    setupEventListeners();
    switchView('home');
    renderRandomRecipes();
}

async function loadRecipes() {
    if (!db || !auth.currentUser) return;

    const userId = auth.currentUser.uid;
    // Load from Firebase under the user's private path
    try {
        const snapshot = await db.ref(`users/${userId}/recipes`).once('value');
        const data = snapshot.val();
        if (data) {
            recipes = Object.values(data);
        } else {
            // If NEW user, seed with default recipes from recipes.json
            const response = await fetch('./recipes.json').catch(() => null);
            if (response && response.ok) {
                recipes = await response.json();
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
        const matchesCategory = currentCategory === 'all' || r.category === currentCategory;
        const matchesSearch = r.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
            r.ingredients.toLowerCase().includes(currentSearch.toLowerCase());
        const matchesView = currentView === 'home' || (currentView === 'favorites' && r.isFavorite);
        return matchesCategory && matchesSearch && matchesView;
    });

    // Hide random recipes if searching, filtering by category, or not in home view
    if (currentSearch || currentCategory !== 'all' || currentView !== 'home') {
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
        card.innerHTML = `
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="recipe-img" alt="${recipe.name}">
            <button class="favorite-btn ${recipe.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${recipe.id})">
                <ion-icon name="${recipe.isFavorite ? 'star' : 'star-outline'}"></ion-icon>
            </button>
            ${recipe.video ? '<div class="video-badge"><ion-icon name="play"></ion-icon></div>' : ''}
            <div class="recipe-info">
                <div class="recipe-tags">
                    <span class="tag">${recipe.category}</span>
                </div>
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

    // Get up to 6 random recipes, shuffle them
    const shuffled = [...recipes].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    selected.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'random-card';
        card.innerHTML = `
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" alt="${recipe.name}">
            <div class="random-card-info">
                <span class="tag">${recipe.category}</span>
                <h3>${recipe.name}</h3>
            </div>
        `;
        card.addEventListener('click', () => viewRecipe(recipe.id));
        randomTrack.appendChild(card);
    });

    let currentSlide = 0;
    if (selected.length > 1) {
        randomCarouselInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % selected.length;
            randomTrack.scrollTo({
                left: randomTrack.offsetWidth * currentSlide,
                behavior: 'smooth'
            });
        }, 5000);
    }
}

// --- Actions ---

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderRecipes();
    });

    // Custom Mobile Category Dropdown
    const dropdown = document.getElementById('category-dropdown');
    const dropdownTrigger = dropdown?.querySelector('.dropdown-trigger');
    const dropdownOptions = dropdown?.querySelectorAll('.dropdown-options li');
    const currentCategoryLabel = document.getElementById('current-category-label');

    if (dropdownTrigger) {
        dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
    }

    if (dropdownOptions) {
        dropdownOptions.forEach(option => {
            option.addEventListener('click', () => {
                const category = option.dataset.category;
                currentCategory = category;
                if (currentCategoryLabel) {
                    currentCategoryLabel.textContent = option.textContent;
                }
                dropdown.classList.remove('active');
                switchView('home');
                renderRecipes();
            });
        });
    }

    // Close dropdown on click outside
    window.addEventListener('click', () => {
        if (dropdown) dropdown.classList.remove('active');
    });

    // Filter Navigation (Icons)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            const category = item.dataset.category;

            if (category) {
                currentCategory = category;
                // Sync mobile label
                if (currentCategoryLabel) {
                    const matchingOption = Array.from(dropdownOptions || []).find(opt => opt.dataset.category === category);
                    if (matchingOption) currentCategoryLabel.textContent = matchingOption.textContent;
                }
            }

            if (view) {
                switchView(view);
            }

            renderRecipes();
        });
    });

    // Cooking Mode & Share
    cookModeBtn.addEventListener('click', () => {
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) openCookMode(r);
    });

    shareRecipeBtn.addEventListener('click', () => {
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) shareRecipe(r);
    });

    exitCookBtn.addEventListener('click', () => {
        cookOverlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Modals
    addBtn.addEventListener('click', () => {
        if (!checkAuth()) return;
        editingRecipeId = null;
        recipeForm.reset();
        updateImagePreview('');
        document.getElementById('modal-title').textContent = 'Nueva Receta';
        recipeModal.style.display = 'block';
    });

    // Image Preview & Google Search
    imageInput.addEventListener('input', (e) => {
        updateImagePreview(e.target.value);
    });

    searchGoogleBtn.addEventListener('click', () => {
        const name = document.getElementById('recipe-name').value;
        if (!name) {
            alert('Por favor, escribe primero el nombre del plato para buscar imágenes.');
            return;
        }
        window.open(`https://www.google.com/search?q=${encodeURIComponent(name)}+receta&tbm=isch`, '_blank');
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            recipeModal.style.display = 'none';
            viewModal.style.display = 'none';
            importModal.style.display = 'none';
            importError.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === recipeModal) recipeModal.style.display = 'none';
        if (e.target === viewModal) viewModal.style.display = 'none';
        if (e.target === importModal) importModal.style.display = 'none';
    });

    // Form Submission
    recipeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveRecipe();
    });

    // View Modal Actions
    document.getElementById('edit-current-btn').addEventListener('click', () => {
        if (!checkAuth()) return;
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) {
            viewModal.style.display = 'none';
            openEditModal(r);
        }
    });

    document.getElementById('delete-current-btn').addEventListener('click', () => {
        if (!checkAuth()) return;
        if (confirm('¿Estás seguro de que quieres borrar esta receta?')) {
            recipes = recipes.filter(rec => rec.id !== editingRecipeId);
            saveToLocalStorage();
            viewModal.style.display = 'none';
            renderRecipes();
            showToast('Receta eliminada correctamente', 'success');
        }
    });

    // JSON Import/Export Events
    importBtn.addEventListener('click', () => {
        if (!checkAuth()) return;
        jsonInput.value = '';
        importError.style.display = 'none';
        importModal.style.display = 'block';
    });

    document.getElementById('export-json-btn').addEventListener('click', () => {
        exportRecipes();
    });

    processJsonBtn.addEventListener('click', () => {
        try {
            const data = JSON.parse(jsonInput.value);
            if (!data.title || !data.ingredients || !data.instructions) {
                throw new Error('Faltan campos (title, ingredients o instructions)');
            }

            const newRecipe = {
                id: Date.now(),
                name: data.title,
                category: data.category || 'Otros',
                ingredients: Array.isArray(data.ingredients) ? data.ingredients.join('\n') : data.ingredients,
                steps: Array.isArray(data.instructions) ? data.instructions.join('\n') : data.instructions,
                video: data.video || '',
                image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`
            };

            recipes.push(newRecipe);
            saveToLocalStorage();
            renderRecipes();
            importModal.style.display = 'none';
        } catch (e) {
            importError.textContent = 'Error: ' + e.message;
            importError.style.display = 'block';
        }
    });

    // Auth Listeners & Visibility
    if (auth) {
        console.log('[DEBUG] Auth inicializado');
        const loginScreen = document.getElementById('login-screen');
        const appDiv = document.getElementById('app');
        const userAvatar = document.getElementById('user-avatar');
        const logoutBtn = document.getElementById('logout-btn');

        auth.onAuthStateChanged(user => {
            console.log('[AUTH] Estado cambiado -> Usuario:', user ? user.uid : 'null');

            if (user) {
                isLoggedIn = true;
                loginScreen.style.display = 'none';
                appDiv.style.display = 'flex';
                if (userAvatar) userAvatar.textContent = user.displayName ? user.displayName[0] : 'U';
                loadRecipes();
            } else {
                isLoggedIn = false;
                loginScreen.style.display = 'flex';
                appDiv.style.display = 'none';
                recipes = [];
                renderRecipes();
            }
        });

        const handleLogin = () => {
            console.log('[DEBUG] Iniciando proceso de login...');
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(err => {
                console.error('[ERROR] Login Popup falló:', err);
                // Si falla el popup, intentamos redirect como respaldo
                auth.signInWithRedirect(provider);
            });
        };

        const mainLoginBtn = document.getElementById('main-login-btn');
        if (mainLoginBtn) mainLoginBtn.onclick = handleLogin;

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                auth.signOut().then(() => {
                    showToast('Sesión cerrada');
                });
            });
        }

        // Recuperar resultado de redirect si el popup fue bloqueado o se usó de respaldo
        auth.getRedirectResult()
            .then(result => {
                if (result.user) console.log('[DEBUG] Login exitoso vía redirect');
            })
            .catch(err => {
                if (err.code !== 'auth/callback-condition-not-met') {
                    console.error('[ERROR] Error en redirect result:', err);
                }
            });
    }
}

function checkAuth() { return isLoggedIn; }

function saveRecipe() {
    const name = document.getElementById('recipe-name').value;
    const category = document.getElementById('recipe-category').value;
    const ingredients = document.getElementById('recipe-ingredients').value;
    const steps = document.getElementById('recipe-steps').value;
    const video = document.getElementById('recipe-video').value;
    const image = document.getElementById('recipe-image').value || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`;
    const time = parseInt(document.getElementById('recipe-time').value) || 30;
    const difficulty = document.getElementById('recipe-difficulty').value;

    if (editingRecipeId) {
        const index = recipes.findIndex(r => r.id === editingRecipeId);
        recipes[index] = { ...recipes[index], name, category, ingredients, steps, video, image, time, difficulty };
    } else {
        const newRecipe = {
            id: Date.now(),
            name,
            category,
            ingredients,
            steps,
            video,
            image,
            time,
            difficulty,
            isFavorite: false
        };
        recipes.push(newRecipe);
    }

    saveToLocalStorage();
    renderRecipes();
    recipeModal.style.display = 'none';
    showToast(editingRecipeId ? 'Receta actualizada' : 'Receta guardada con éxito');
}

function openEditModal(recipe) {
    editingRecipeId = recipe.id;
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-category').value = recipe.category;
    document.getElementById('recipe-ingredients').value = recipe.ingredients;
    document.getElementById('recipe-steps').value = recipe.steps;
    document.getElementById('recipe-video').value = recipe.video;
    document.getElementById('recipe-image').value = recipe.image || '';
    document.getElementById('recipe-time').value = recipe.time || '';
    document.getElementById('recipe-difficulty').value = recipe.difficulty || 'Media';

    updateImagePreview(recipe.image || '');
    document.getElementById('modal-title').textContent = 'Editar Receta';
    recipeModal.style.display = 'block';
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

function viewRecipe(id) {
    editingRecipeId = id;
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    const detailsContainer = document.getElementById('recipe-details');
    const embedUrl = getYoutubeEmbedUrl(recipe.video);

    detailsContainer.innerHTML = `
        <div class="detail-header-info">
            <span class="tag">${recipe.category}</span>
            <h2>${recipe.name}</h2>
        </div>
        
        <img src="${recipe.image || 'https://images.unsplash.com/photo-1495195129352-aed325a55b65?auto=format&fit=crop&q=80&w=800'}" class="detail-img" alt="${recipe.name}">
        
        <h3 class="section-title">Ingredientes</h3>
        <p class="ingredients-list">${recipe.ingredients}</p>
        
        <h3 class="section-title">Preparación</h3>
        <p class="steps-list">${recipe.steps}</p>
        
        ${embedUrl ? `
            <h3 class="section-title">Video Tutorial</h3>
            <div class="video-container">
                <iframe src="${embedUrl}" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        ` : ''}
    `;

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
        if (currentView === 'home' && currentCategory === 'all' && !currentSearch) {
            renderRandomRecipes();
        }
    }
}

// --- Views & Features ---

function switchView(view) {
    currentView = view;

    // Hide all
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

    // Update active state for all nav items (desktop + mobile)
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === view) {
            // Only mark as active if it matches the current view
            // Exception: home category items only if currentView is home
            if (view === 'home') {
                if (item.getAttribute('data-category') === currentCategory) {
                    item.classList.add('active');
                }
            } else {
                item.classList.add('active');
            }
        }
    });

    // Update Category label in custom mobile dropdown
    const currentCategoryLabel = document.getElementById('current-category-label');
    if (currentCategoryLabel && view === 'home') {
        const option = document.querySelector(`.dropdown-options li[data-category="${currentCategory}"]`);
        if (option) currentCategoryLabel.textContent = option.textContent;
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
    plannerDayName.textContent = day;

    plannerOptions.innerHTML = '';

    if (recipes.length === 0) {
        plannerOptions.innerHTML = '<p class="no-recipes small">No tienes recetas guardadas aún.</p>';
    } else {
        recipes.forEach(r => {
            const div = document.createElement('div');
            div.className = 'planner-option-item';
            div.innerHTML = `
                <img src="${r.image}" alt="${r.name}">
                <span>${r.name}</span>
            `;
            div.onclick = () => {
                if (!plannerData[day]) plannerData[day] = [];
                plannerData[day].push(r.id);
                savePlannerData();
                renderWeeklyPlanner();
                plannerModal.style.display = 'none';
            };
            plannerOptions.appendChild(div);
        });
    }

    plannerModal.style.display = 'block';
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
    document.getElementById('cook-title').textContent = recipe.name;
    const ingredientsList = document.getElementById('cook-ingredients-list');
    const stepsDiv = document.getElementById('cook-steps-list');

    // Split by newlines, commas or semicolons to separate ingredients correctly
    ingredientsList.innerHTML = recipe.ingredients.split(/[\n,;]+/).filter(i => i.trim()).map(i => `
        <li onclick="this.classList.toggle('checked')">${i.trim()}</li>
    `).join('');

    stepsDiv.innerHTML = recipe.steps.split('\n').filter(s => s.trim()).map(s => `
        <p>${s}</p>
    `).join('');

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
