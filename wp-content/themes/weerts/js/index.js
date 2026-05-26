/**
 * Marks the document as JavaScript-enabled once the page has loaded.
 */
function initSite() {
    document.documentElement.classList.remove('no-js')
    document.documentElement.classList.add('js')
}

document.addEventListener('DOMContentLoaded', initSite)
