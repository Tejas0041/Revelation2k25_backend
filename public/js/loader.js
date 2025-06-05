class ModernLoader {
    constructor() {
        if (!document.getElementById('loader-overlay')) {
            this.createLoader();
        }
        this.loader = document.getElementById('loader-overlay');
        this.showLoader();
        this.setupPageLoadHandler();
    }

    createLoader() {
        const loaderHtml = `
            <div id="loader-overlay" class="modern-loader">
                <div class="loader-content">
                    <div class="loader-animation">
                        <div class="loader-circle"></div>
                        <div class="loader-circle"></div>
                        <div class="loader-circle"></div>
                    </div>
                    <div class="loader-text">Loading...</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loaderHtml);
    }

    showLoader() {
        this.loader.style.display = 'flex';
        this.loader.classList.remove('hide');
    }

    hideLoader() {
        this.loader.classList.add('hide');
        setTimeout(() => {
            this.loader.style.display = 'none';
        }, 300);
    }

    setupPageLoadHandler() {
        if (document.readyState === 'complete') {
            setTimeout(() => this.hideLoader(), 1000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => this.hideLoader(), 1000);
            });
        }
    }
}

// Initialize loader
const loader = new ModernLoader();
window.modernLoader = loader;
