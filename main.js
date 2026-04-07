// Recipe Data Management
let recipes = [];
let currentCategory = 'all';
let currentSearch = '';
let editingRecipeId = null;

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

// --- Initialization ---

function init() {
    loadRecipes();
    setupEventListeners();
    renderRecipes();
    renderRandomRecipes();
}

function loadRecipes() {
    const stored = localStorage.getItem('gusto_recipes');
    if (stored) {
        recipes = JSON.parse(stored);
    } else {
        // Sample data for first time
        recipes = [
            {
                id: Date.now() + 1,
                name: 'Tacos Al Pastor',
                category: 'Carnes',
                video: 'https://www.youtube.com/watch?v=f-B65R8n8gU',
                ingredients: 'Carne de cerdo, piña, tortillas, cilantro, cebolla, adobo.',
                steps: '1. Adobar la carne.\n2. Cocinar a fuego lento.\n3. Servir en tortillas con piña.',
                image: 'https://images.unsplash.com/photo-1593350071499-14eafa834830?auto=format&fit=crop&q=80&w=800'
            },
            {
                id: Date.now() + 2,
                name: 'Pasta Carbonara Auténtica',
                category: 'Pastas',
                video: '',
                ingredients: 'Espaguetis, guanciale, huevos, queso pecorino, pimienta negra.',
                steps: '1. Cocer la pasta.\n2. Saltear el guanciale.\n3. Mezclar huevos y queso.\n4. Unir todo fuera del fuego.',
                image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&q=80&w=800'
            },
            {
                id: Date.now() + 3,
                name: 'Ensalada Burrata con Pesto',
                category: 'Ensaladas',
                video: 'https://www.youtube.com/watch?v=7uunR0lEqos',
                ingredients: 'Burrata fresca, tomates cherry, pesto genovese, rúcula, aceite de oliva.',
                steps: '1. Lavar la rúcula y ponerla de base.\n2. Colocar la burrata en el centro.\n3. Decorar con tomates y bañar en pesto.',
                image: 'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?auto=format&fit=crop&q=80&w=800'
            }
        ];
        saveToLocalStorage();
    }
}

function saveToLocalStorage() {
    localStorage.setItem('gusto_recipes', JSON.stringify(recipes));
}

// --- Rendering ---

function renderRecipes() {
    const filtered = recipes.filter(r => {
        const matchesCategory = currentCategory === 'all' || r.category === currentCategory;
        const matchesSearch = r.name.toLowerCase().includes(currentSearch.toLowerCase()) || 
                             r.ingredients.toLowerCase().includes(currentSearch.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Hide random recipes if searching or filtering by category
    if (currentSearch || currentCategory !== 'all') {
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
            ${recipe.video ? '<div class="video-badge"><ion-icon name="play"></ion-icon></div>' : ''}
            <div class="recipe-info">
                <div class="recipe-tags">
                    <span class="tag">${recipe.category}</span>
                </div>
                <h3>${recipe.name}</h3>
                <div class="recipe-meta">
                    <span><ion-icon name="nutrition-outline"></ion-icon> ${recipe.category}</span>
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
    
    // Get up to 6 random recipes, shuffle them
    const shuffled = [...recipes].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 6);

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
}

// --- Actions ---

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderRecipes();
    });

    // Filter Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            categoryTitle.textContent = item.textContent === 'Todo' ? 'Mis Recetas' : item.textContent;
            renderRecipes();
        });
    });

    // Modals
    addBtn.addEventListener('click', () => {
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
        const r = recipes.find(rec => rec.id === editingRecipeId);
        if (r) {
            viewModal.style.display = 'none';
            openEditModal(r);
        }
    });

    document.getElementById('delete-current-btn').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar esta receta?')) {
            recipes = recipes.filter(rec => rec.id !== editingRecipeId);
            saveToLocalStorage();
            viewModal.style.display = 'none';
            renderRecipes();
        }
    });

    // JSON Import Event
    importBtn.addEventListener('click', () => {
        jsonInput.value = '';
        importError.style.display = 'none';
        importModal.style.display = 'block';
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
}

function saveRecipe() {
    const name = document.getElementById('recipe-name').value;
    const category = document.getElementById('recipe-category').value;
    const ingredients = document.getElementById('recipe-ingredients').value;
    const steps = document.getElementById('recipe-steps').value;
    const video = document.getElementById('recipe-video').value;
    const image = document.getElementById('recipe-image').value || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`;

    if (editingRecipeId) {
        const index = recipes.findIndex(r => r.id === editingRecipeId);
        recipes[index] = { ...recipes[index], name, category, ingredients, steps, video, image };
    } else {
        const newRecipe = {
            id: Date.now(),
            name,
            category,
            ingredients,
            steps,
            video,
            image
        };
        recipes.push(newRecipe);
    }

    saveToLocalStorage();
    renderRecipes();
    recipeModal.style.display = 'none';
}

function openEditModal(recipe) {
    editingRecipeId = recipe.id;
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-category').value = recipe.category;
    document.getElementById('recipe-ingredients').value = recipe.ingredients;
    document.getElementById('recipe-steps').value = recipe.steps;
    document.getElementById('recipe-video').value = recipe.video;
    document.getElementById('recipe-image').value = recipe.image || '';
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

    viewModal.style.display = 'block';
}

function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

// Kickstart
init();
