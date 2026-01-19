const shaderCache = new Map()
const includeCache = new Map()

const INCLUDES_PATH = 'src/shaders/includes/'

export async function loadShaderSource(path) {
    if (shaderCache.has(path)) {
        return shaderCache.get(path)
    }

    const response = await fetch(path)
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${path}`)
    }

    let source = await response.text()

    // Resolve #include directives
    source = await resolveIncludes(source)

    shaderCache.set(path, source)

    return source
}

async function resolveIncludes(source) {
    // Match #include "filename.glsl" or #include <filename.glsl>
    const includeRegex = /#include\s+["<]([^">]+)[">]/g
    const matches = [...source.matchAll(includeRegex)]

    for (const match of matches) {
        const includeName = match[1]
        const includeSource = await loadInclude(includeName)
        source = source.replace(match[0], includeSource)
    }

    return source
}

async function loadInclude(name) {
    if (includeCache.has(name)) {
        return includeCache.get(name)
    }

    const path = INCLUDES_PATH + name
    const response = await fetch(path)
    if (!response.ok) {
        throw new Error(`Failed to load shader include: ${path}`)
    }

    const source = await response.text()
    includeCache.set(name, source)

    return source
}

export async function loadShaderPair(vertexPath, fragmentPath) {
    const [vertexSource, fragmentSource] = await Promise.all([
        loadShaderSource(vertexPath),
        loadShaderSource(fragmentPath)
    ])

    return { vertexSource, fragmentSource }
}

export function clearShaderCache() {
    shaderCache.clear()
    includeCache.clear()
}
