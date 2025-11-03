// ==================================================================================
// health42 - Main Application Logic
// ==================================================================================

document.addEventListener('DOMContentLoaded', () => {
  const app = new Health42App();
  app.init();
});

class Health42App {
  // ----------------------------------------------------------------------------------
  // 1. CONFIGURATION
  // ----------------------------------------------------------------------------------
  constructor() {
    this.config = {
      brand: 'health42',
      supportEmail: 'support@health42.net',
      adminKey: 'CHANGE_ME_LONG_RANDOM_VALUE', // IMPORTANT: Change this value!
      webhookUrl: 'https://api.encharge.io/v1/hooks/344f8226-cad7-4310-b773-776045dd98b2',
      categories: [
        'Dietary Supplements',
        'Men’s Health',
        'Women’s Health',
        'Dental Health',
        'Beauty',
        'Diets & Weight Loss',
        'Nutrition',
        'Remedies'
      ],
      postsPerPage: 9,
      supplementsPerPage: 12,
    };

    this.state = {
      supplements: [],
      posts: [],
      filteredSupplements: [],
      filteredPosts: [],
    };

    // Cache DOM elements
    this.cacheDom();
  }

  // ----------------------------------------------------------------------------------
  // 2. INITIALIZATION
  // ----------------------------------------------------------------------------------
  init() {
    this.page = document.body.dataset.page;
    if (!this.page) return;

    this.addGlobalListeners();

    // Page-specific initializers
    switch (this.page) {
      case 'home':
        this.initHomepage();
        break;
      case 'catalog':
        this.initCatalog();
        break;
      case 'supplement':
        this.initSupplementPage();
        break;
      case 'blog':
        this.initBlog();
        break;
      case 'post':
        this.initPostPage();
        break;
      case 'contact':
        this.initContactPage();
        break;
      case 'admin-supplement':
      case 'admin-post':
        this.initAdminPage();
        break;
    }
    
    this.updateActiveNav();
    this.checkForAnalyticsExport();
  }

  cacheDom() {
    this.dom = {
        header: this.qs('header'),
        footer: this.qs('footer'),
    };
  }

  // ----------------------------------------------------------------------------------
  // 3. HELPERS
  // ----------------------------------------------------------------------------------
  qs = (selector, context = document) => context.querySelector(selector);
  qsa = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  getParam = (name) => new URLSearchParams(window.location.search).get(name);
  formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  
  safeFetch = async (url, options) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  };

  getLocalStorage = (key, defaultValue = []) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return defaultValue;
    }
  };

  setLocalStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error writing to localStorage', e);
    }
  };

  showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Animate out and remove
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
  };

  // ----------------------------------------------------------------------------------
  // 4. DATA LOADING
  // ----------------------------------------------------------------------------------
  async loadSupplements() {
    if (this.state.supplements.length > 0) return this.state.supplements;
    const seed = await this.safeFetch('./data/supplements.json') || [];
    const pending = this.getLocalStorage('pendingSupplements');
    const merged = [...seed, ...pending];
    // De-dupe by ID, giving preference to pending (newer) items
    const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
    this.state.supplements = unique.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    return this.state.supplements;
  }

  async loadPosts() {
    if (this.state.posts.length > 0) return this.state.posts;
    const seed = await this.safeFetch('./data/posts.json') || [];
    const pending = this.getLocalStorage('pendingPosts');
    const merged = [...seed, ...pending];
    const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
    this.state.posts = unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return this.state.posts;
  }

  // ----------------------------------------------------------------------------------
  // 5. RENDERING
  // ----------------------------------------------------------------------------------
  renderSupplementCard(supplement) {
    const { id, name, brand, shortDescription, images, price, compareAtPrice, rating, reviewsCount } = supplement;
    const ratingHtml = this.renderRating(rating);
    return `
      <a href="./supplement.html?id=${id}" class="card supplement-card">
        <img src="${images[0]}" alt="${name}" class="card-image" loading="lazy" width="400" height="400">
        <div class="card-content">
          <h3 class="card-title">${name}</h3>
          <p class="card-excerpt">${brand}</p>
          <div class="rating-stars" title="${rating} out of 5 stars">${ratingHtml} <span class="reviews-count">(${reviewsCount})</span></div>
        </div>
        <div class="card-footer">
            <div class="price">${this.formatCurrency(price)}
            ${compareAtPrice ? `<span class="compare-at-price">${this.formatCurrency(compareAtPrice)}</span>` : ''}
            </div>
        </div>
      </a>
    `;
  }

  renderPostCard(post) {
    const { id, title, excerpt, coverImage, publishedAt } = post;
    const date = new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
      <a href="./post.html?id=${id}" class="card post-card">
        <img src="${coverImage}" alt="${title}" class="card-image" loading="lazy" width="400" height="250">
        <div class="card-content">
          <h3 class="card-title">${title}</h3>
          <p class="card-excerpt">${excerpt}</p>
        </div>
        <div class="card-footer">
            <time datetime="${publishedAt}">${date}</time>
        </div>
      </a>
    `;
  }

  renderRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars += '<span>&#9733;</span>'; // Full star
      } else if (i - 0.5 <= rating) {
        stars += '<span>&#9733;</span>'; // Full star for half ratings for simplicity
      } else {
        stars += '<span class="star-empty">&#9734;</span>'; // Empty star
      }
    }
    return stars;
  }

  // ----------------------------------------------------------------------------------
  // 6. PAGE INITIALIZERS
  // ----------------------------------------------------------------------------------
  async initHomepage() {
    const [supplements, posts] = await Promise.all([this.loadSupplements(), this.loadPosts()]);
    
    // Featured supplements (top 3 rated)
    const featuredSupps = [...supplements].sort((a, b) => b.rating - a.rating).slice(0, 3);
    const featuredContainer = this.qs('#featured-supplements-grid');
    if(featuredContainer) featuredContainer.innerHTML = featuredSupps.map(s => this.renderSupplementCard(s)).join('');

    // Latest posts (top 3 newest)
    const latestPosts = posts.slice(0, 3);
    const postsContainer = this.qs('#latest-posts-grid');
    if(postsContainer) postsContainer.innerHTML = latestPosts.map(p => this.renderPostCard(p)).join('');
  }

  async initCatalog() {
    await this.loadSupplements();
    this.state.filteredSupplements = [...this.state.supplements];
    
    this.catalogDom = {
        grid: this.qs('#catalog-grid'),
        count: this.qs('#results-count'),
        categoryFilter: this.qs('#category-filter'),
        sortSelect: this.qs('#sort-select'),
        searchInput: this.qs('#search-input'),
        pagination: this.qs('#pagination'),
    };

    this.populateCategoryFilter();
    this.addCatalogListeners();
    this.renderCatalogPage(1);
  }

  async initBlog() {
    await this.loadPosts();
    this.state.filteredPosts = [...this.state.posts];
    this.blogDom = {
        grid: this.qs('#blog-grid'),
    };
    this.renderBlogGrid();
  }

  async initSupplementPage() {
    const supplementId = this.getParam('id');
    if (!supplementId) {
      this.qs('main').innerHTML = '<h1>Supplement not found</h1><p>No supplement ID was provided.</p>';
      return;
    }
    await this.loadSupplements();
    const supplement = this.state.supplements.find(s => s.id === supplementId);

    if (!supplement) {
      this.qs('main').innerHTML = '<h1>Supplement not found</h1><p>The requested supplement could not be found.</p>';
      return;
    }

    this.renderSupplementDetails(supplement);
  }

  async initPostPage() {
    const postId = this.getParam('id');
    if (!postId) {
        this.qs('main').innerHTML = '<h1>Post not found</h1><p>No post ID was provided.</p>';
        return;
    }
    await this.loadPosts();
    const post = this.state.posts.find(p => p.id === postId);

    if (!post) {
        this.qs('main').innerHTML = '<h1>Post not found</h1><p>The requested post could not be found.</p>';
        return;
    }

    this.renderPostDetails(post);
  }

  initContactPage() {
    const form = this.qs('#contact-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      if (data.website) { // Honeypot
        console.log('Honeypot triggered');
        return;
      }

      const payload = {
        type: 'contact_message',
        source: 'health42_site',
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      };

      const result = await this.safeFetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (result) {
        this.showToast('Thank you for your message! We will get back to you soon.');
        form.reset();
      } else {
        this.showToast('Something went wrong. Please try again.', 'danger');
      }
    });
  }

  initAdminPage() {
    if (this.getParam('key') !== this.config.adminKey) {
      this.showToast('Invalid admin key.', 'danger');
      setTimeout(() => window.location.href = './index.html', 1000);
      return;
    }

    if (this.page === 'admin-supplement') {
        const form = this.qs('#supplement-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminSupplementSubmit(form);
        });
        this.qs('#export-supplements').addEventListener('click', () => this.exportJson('supplements'));
    }

    if (this.page === 'admin-post') {
        const form = this.qs('#post-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminPostSubmit(form);
        });
        this.qs('#export-posts').addEventListener('click', () => this.exportJson('posts'));
    }
  }

  // ----------------------------------------------------------------------------------
  // 7. EVENT LISTENERS & HANDLERS
  // ----------------------------------------------------------------------------------
  addGlobalListeners() {
    this.qsa('.newsletter-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            if (data.website) { // Honeypot
                console.log('Honeypot triggered');
                return;
            }

            const payload = {
                type: 'newsletter_signup',
                source: 'health42_site',
                email: data.email,
                name: data.name || '',
            };

            const result = await this.safeFetch(this.config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (result) {
                this.showToast('Thanks for subscribing! Please check your inbox.');
                form.reset();
            } else {
                this.showToast('Could not subscribe. Please try again.', 'danger');
            }
        });
    });
  }

  addCatalogListeners() {
    let debounceTimer;
    this.catalogDom.searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            this.applyCatalogFilters();
            this.renderCatalogPage(1);
        }, 300);
    });

    this.catalogDom.categoryFilter.addEventListener('change', () => {
        this.applyCatalogFilters();
        this.renderCatalogPage(1);
    });

    this.catalogDom.sortSelect.addEventListener('change', () => {
        this.applyCatalogFilters();
        this.renderCatalogPage(1);
    });
  }

  // ----------------------------------------------------------------------------------
  // 8. PAGE-SPECIFIC LOGIC
  // ----------------------------------------------------------------------------------

  // Catalog Logic
  populateCategoryFilter() {
    this.config.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        this.catalogDom.categoryFilter.appendChild(option);
    });
  }

  applyCatalogFilters() {
    const searchTerm = this.catalogDom.searchInput.value.toLowerCase();
    const category = this.catalogDom.categoryFilter.value;
    const sort = this.catalogDom.sortSelect.value;

    let result = [...this.state.supplements];

    // Filter
    if (category) {
        result = result.filter(s => s.category === category);
    }
    if (searchTerm) {
        result = result.filter(s => 
            s.name.toLowerCase().includes(searchTerm) || 
            s.brand.toLowerCase().includes(searchTerm) || 
            s.tags.join(' ').toLowerCase().includes(searchTerm)
        );
    }

    // Sort
    switch (sort) {
        case 'rating_desc':
            result.sort((a, b) => b.rating - a.rating);
            break;
        case 'price_asc':
            result.sort((a, b) => a.price - b.price);
            break;
        case 'price_desc':
            result.sort((a, b) => b.price - a.price);
            break;
        case 'newest':
            result.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
            break;
    }

    this.state.filteredSupplements = result;
  }

  renderCatalogPage(page) {
    const start = (page - 1) * this.config.supplementsPerPage;
    const end = start + this.config.supplementsPerPage;
    const pageItems = this.state.filteredSupplements.slice(start, end);

    this.catalogDom.grid.innerHTML = pageItems.map(s => this.renderSupplementCard(s)).join('');
    this.catalogDom.count.textContent = `${this.state.filteredSupplements.length} results found`;
    this.renderPagination(page, this.state.filteredSupplements.length, this.config.supplementsPerPage, this.catalogDom.pagination, this.renderCatalogPage.bind(this));
  }

  // Blog Logic
  renderBlogGrid() {
    this.blogDom.grid.innerHTML = this.state.filteredPosts.map(p => this.renderPostCard(p)).join('');
  }

  // Pagination Logic
  renderPagination(currentPage, totalItems, perPage, container, renderPageFn) {
    const totalPages = Math.ceil(totalItems / perPage);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = 'btn';
        if (i === currentPage) {
            button.classList.add('btn-primary');
            button.disabled = true;
        } else {
            button.classList.add('btn-secondary');
            button.addEventListener('click', () => renderPageFn(i));
        }
        container.appendChild(button);
    }
  }

  // Supplement Detail Logic
  renderSupplementDetails(supplement) {
    document.title = `${supplement.name} | ${this.config.brand}`;
    this.qs('meta[name="description"]').content = supplement.shortDescription;

    const mainContent = this.qs('#supplement-content');
    if (!mainContent) return;

    const hoplink = supplement.clickbankHoplink.replace('{{utm}}', `product_${supplement.id}`);

    mainContent.innerHTML = `
        <div class="supplement-header">
            <div class="product-gallery">
                <div class="main-image">
                    <img src="${supplement.images[0]}" alt="${supplement.name}" id="main-product-image">
                </div>
                <div class="product-thumbnails">
                    ${supplement.images.map((img, index) => `<img src="${img}" alt="Thumbnail ${index+1}" class="${index === 0 ? 'active' : ''}">`).join('')}
                </div>
            </div>
            <div class="product-info">
                <div class="category">${supplement.category}</div>
                <h1>${supplement.name}</h1>
                <div class="brand">By ${supplement.brand}</div>
                <div class="rating-stars">${this.renderRating(supplement.rating)} <span>(${supplement.reviewsCount} reviews)</span></div>
                <div class="price" style="margin-top: 1rem;">${this.formatCurrency(supplement.price)}
                    ${supplement.compareAtPrice ? `<span class="compare-at-price">${this.formatCurrency(supplement.compareAtPrice)}</span>` : ''}
                </div>
                <p>${supplement.shortDescription}</p>
                <div class="product-actions">
                    <a href="${hoplink}" target="_blank" class="btn btn-accent btn-lg" id="cta-button">Buy on ClickBank</a>
                    <div class="medical-disclaimer">This is an affiliate link. We may earn a commission on qualifying purchases.</div>
                </div>
            </div>
        </div>
        <div class="supplement-details">
            <h3>Description</h3>
            <div>${supplement.descriptionHtml}</div>
            <h3>Ingredients</h3>
            <table class="ingredients-table">
                <thead><tr><th>Ingredient</th><th>Dose</th><th>Note</th></tr></thead>
                <tbody>
                    ${supplement.ingredients.map(i => `<tr><td>${i.name}</td><td>${i.dose}</td><td>${i.note || ''}</td></tr>`).join('')}
                </tbody>
            </table>
            <h3>Directions</h3>
            <p>${supplement.directions}</p>
            <h3>Warnings</h3>
            <p>${supplement.warnings}</p>
        </div>
    `;

    this.addSupplementPageListeners(supplement);
  }

  addSupplementPageListeners(supplement) {
    const ctaButton = this.qs('#cta-button');
    ctaButton.addEventListener('click', () => {
        const analytics = this.getLocalStorage('analytics', []);
        analytics.push({ 
            id: supplement.id, 
            url: ctaButton.href, 
            timestamp: new Date().toISOString() 
        });
        this.setLocalStorage('analytics', analytics);
    });

    this.qsa('.product-thumbnails img').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            this.qs('#main-product-image').src = e.target.src;
            this.qsa('.product-thumbnails img').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
  }

  // Post Detail Logic
  renderPostDetails(post) {
    document.title = `${post.title} | ${this.config.brand}`;
    this.qs('meta[name="description"]').content = post.excerpt;

    const mainContent = this.qs('#post-content');
    if (!mainContent) return;

    const pubDate = new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    mainContent.innerHTML = `
        <img src="${post.coverImage}" alt="${post.title}" style="width:100%; border-radius: var(--radius-lg); margin-bottom: 2rem;">
        <h1>${post.title}</h1>
        <div class="post-meta">
            <span>By ${post.author}</span> | 
            <time datetime="${post.publishedAt}">${pubDate}</time> | 
            <span>${post.category}</span>
        </div>
        <div class="post-body">${post.bodyHtml}</div>
    `;
  }

  // ----------------------------------------------------------------------------------
  // 9. ADMIN LOGIC
  // ----------------------------------------------------------------------------------
  handleAdminSupplementSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const newSupplement = {
        id: data.id || `custom-${Date.now()}`,
        name: data.name,
        brand: data.brand,
        category: data.category,
        tags: data.tags.split(',').map(t => t.trim()),
        shortDescription: data.shortDescription,
        descriptionHtml: data.descriptionHtml,
        ingredients: data.ingredients.split('\n').map(line => {
            const [name, dose, note] = line.split('|');
            return { name: name.trim(), dose: dose.trim(), note: note ? note.trim() : '' };
        }),
        servingsPerContainer: Number(data.servingsPerContainer),
        directions: data.directions,
        warnings: data.warnings,
        allergens: data.allergens.split(',').map(t => t.trim()),
        price: parseFloat(data.price),
        compareAtPrice: parseFloat(data.compareAtPrice) || 0,
        rating: parseFloat(data.rating),
        reviewsCount: Number(data.reviewsCount),
        images: data.images.split(',').map(t => t.trim()),
        clickbankHoplink: data.clickbankHoplink,
        sku: data.sku,
        countryOfOrigin: data.countryOfOrigin,
        certifications: data.certifications.split(',').map(t => t.trim()),
        lastUpdated: new Date().toISOString(),
    };

    const pending = this.getLocalStorage('pendingSupplements');
    pending.push(newSupplement);
    this.setLocalStorage('pendingSupplements', pending);
    this.showToast('Supplement saved locally. Export to update the live data.');
    form.reset();
  }

  handleAdminPostSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const newPost = {
        id: data.id || `custom-${Date.now()}`,
        title: data.title,
        excerpt: data.excerpt,
        bodyHtml: data.bodyHtml,
        coverImage: data.coverImage,
        author: data.author,
        category: data.category,
        tags: data.tags.split(',').map(t => t.trim()),
        publishedAt: new Date(data.publishedAt).toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const pending = this.getLocalStorage('pendingPosts');
    pending.push(newPost);
    this.setLocalStorage('pendingPosts', pending);
    this.showToast('Post saved locally. Export to update the live data.');
    form.reset();
  }

  async exportJson(type) {
    let data;
    if (type === 'supplements') {
        data = await this.loadSupplements();
    } else {
        data = await this.loadPosts();
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.showToast(`${type}.json has been downloaded.`);
  }

  // ----------------------------------------------------------------------------------
  // 10. MISC
  // ----------------------------------------------------------------------------------
  updateActiveNav() {
    const currentPath = window.location.pathname.split('/').pop();
    this.qsa('.main-nav a').forEach(a => {
        const linkPath = a.getAttribute('href').replace('./', '');
        if (linkPath === currentPath) {
            a.classList.add('active');
        }
    });
  }

  checkForAnalyticsExport() {
    if (this.getParam('analytics') === '1') {
        const analytics = this.getLocalStorage('analytics');
        if (!analytics || analytics.length === 0) {
            this.showToast('No analytics data to export.', 'danger');
            return;
        }
        const header = Object.keys(analytics[0]).join(',');
        const rows = analytics.map(row => Object.values(row).join(','));
        const csvContent = `data:text/csv;charset=utf-8,${header}\n${rows.join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'analytics_export.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
  }
}
