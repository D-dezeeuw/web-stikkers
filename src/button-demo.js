/**
 * Button Demo - Interactive showcase of shader buttons
 */

import { ShaderButtonElement, ShaderButton } from './lib/shaderButtonElement.js'

// Get shader and variant names from component
const SHADERS = ShaderButton.shaderNames
const VARIANTS = ShaderButton.variantNames

/**
 * Create a shader button element
 */
function createButton(shader, mode = 'background', variant = null, label = null) {
    const btn = document.createElement('shader-button')
    btn.setAttribute('shader', shader)
    btn.setAttribute('mode', mode)
    if (variant) {
        btn.setAttribute('variant', variant)
    }
    btn.textContent = label || capitalizeFirst(shader)
    return btn
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ')
}

/**
 * Initialize shader grids
 */
function initGrids() {
    // Background mode grid
    const bgGrid = document.getElementById('background-grid')
    for (const shader of SHADERS) {
        const group = document.createElement('div')
        group.className = 'button-group'

        const label = document.createElement('span')
        label.className = 'button-label'
        label.textContent = shader

        const btn = createButton(shader, 'background')

        group.appendChild(label)
        group.appendChild(btn)
        bgGrid.appendChild(group)
    }

    // Border mode grid
    const borderGrid = document.getElementById('border-grid')
    for (const shader of SHADERS) {
        const group = document.createElement('div')
        group.className = 'button-group'

        const label = document.createElement('span')
        label.className = 'button-label'
        label.textContent = shader

        const btn = createButton(shader, 'border')

        group.appendChild(label)
        group.appendChild(btn)
        borderGrid.appendChild(group)
    }

    // Variant grid
    const variantGrid = document.getElementById('variant-grid')
    for (const variant of VARIANTS) {
        const group = document.createElement('div')
        group.className = 'button-group'

        const label = document.createElement('span')
        label.className = 'button-label'
        label.textContent = variant

        const btn = createButton('holographic', 'background', variant, capitalizeFirst(variant))

        group.appendChild(label)
        group.appendChild(btn)
        variantGrid.appendChild(group)
    }
}

/**
 * Initialize interactive builder
 */
function initBuilder() {
    const shaderSelect = document.getElementById('shader-select')
    const modeSelect = document.getElementById('mode-select')
    const variantSelect = document.getElementById('variant-select')
    const previewButton = document.getElementById('preview-button')
    const codePreview = document.getElementById('code-preview')

    // Populate shader select
    for (const shader of SHADERS) {
        const option = document.createElement('option')
        option.value = shader
        option.textContent = capitalizeFirst(shader)
        shaderSelect.appendChild(option)
    }

    // Populate variant select
    for (const variant of VARIANTS) {
        const option = document.createElement('option')
        option.value = variant
        option.textContent = capitalizeFirst(variant)
        variantSelect.appendChild(option)
    }

    // Update preview function
    function updatePreview() {
        const shader = shaderSelect.value
        const mode = modeSelect.value
        const variant = variantSelect.value

        previewButton.setAttribute('shader', shader)
        previewButton.setAttribute('mode', mode)

        if (variant) {
            previewButton.setAttribute('variant', variant)
        } else {
            previewButton.removeAttribute('variant')
        }

        // Update background for border mode
        if (mode === 'border') {
            previewButton.style.background = '#16213e'
        } else {
            previewButton.style.background = ''
        }

        // Update code preview
        let code = `<shader-button\n  shader="${shader}"\n  mode="${mode}"`
        if (variant) {
            code += `\n  variant="${variant}"`
        }
        code += `>\n  Button Text\n</shader-button>`
        codePreview.textContent = code
    }

    // Event listeners
    shaderSelect.addEventListener('change', updatePreview)
    modeSelect.addEventListener('change', updatePreview)
    variantSelect.addEventListener('change', updatePreview)

    // Initial update
    updatePreview()
}

// Initialize on load
initGrids()
initBuilder()
