import { test, expect } from '@playwright/test'

test.describe('Sticker Demo - Random Emoji Card Name Match', () => {
    test('random emoji card name matches generated emoji name', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Select random-emoji source
        const srcSelect = page.locator('#card-src-select')
        await srcSelect.selectOption('random-emoji')

        // Wait for the source to load and name to be generated
        await page.waitForTimeout(500)

        // Get the generated name from the sticker instance
        const generatedName = await page.evaluate(() => {
            const card = document.getElementById('demo-card')
            return card.generatedName
        })

        // Get the value displayed in the card-name input field
        const inputValue = await page.locator('#card-name').inputValue()

        // Get the card-name attribute on the sticker element
        const cardNameAttr = await page.locator('#demo-card').getAttribute('card-name')

        // All three should match - this catches the double-generation bug
        expect(generatedName).toBeTruthy()
        expect(inputValue).toBe(generatedName)
        expect(cardNameAttr).toBe(generatedName)
    })

    test('random emoji card shows consistent name after multiple source changes', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Switch to random-emoji multiple times to ensure consistency
        const srcSelect = page.locator('#card-src-select')

        for (let i = 0; i < 3; i++) {
            // Switch to custom first
            await srcSelect.selectOption('custom')
            await page.waitForTimeout(100)

            // Then switch to random-emoji
            await srcSelect.selectOption('random-emoji')
            await page.waitForTimeout(500)

            // Verify name consistency
            const generatedName = await page.evaluate(() => {
                const card = document.getElementById('demo-card')
                return card.generatedName
            })
            const inputValue = await page.locator('#card-name').inputValue()
            const cardNameAttr = await page.locator('#demo-card').getAttribute('card-name')

            expect(generatedName, `Iteration ${i + 1}: generatedName should be truthy`).toBeTruthy()
            expect(inputValue, `Iteration ${i + 1}: input should match generated name`).toBe(generatedName)
            expect(cardNameAttr, `Iteration ${i + 1}: attribute should match generated name`).toBe(generatedName)
        }
    })

    test('emoji card visual shows correct emoji for name (fixed emoji)', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Use a specific emoji for deterministic visual testing
        // Set card-src to "random-emoji:🦊" to force the Fox emoji
        const demoCard = page.locator('#demo-card')
        await demoCard.evaluate((el) => {
            el.setAttribute('card-src', 'random-emoji:🦊')
        })

        // Wait for the source to load
        await page.waitForTimeout(500)

        // Verify the generated name is "Fox" and stop animation
        const generatedName = await page.evaluate(() => {
            const card = document.getElementById('demo-card')
            card.sticker?.stop()
            return card.generatedName
        })

        expect(generatedName).toBe('Fox')

        // Wait for animation to fully stop
        await page.waitForTimeout(100)

        // Take a screenshot - should show the fox emoji with "Fox" name
        const card = page.locator('#demo-card')
        await expect(card).toHaveScreenshot('emoji-card-fox.png', {
            maxDiffPixelRatio: 0.10,  // 10% threshold for animated bloom/holographic content
            maxDiffPixels: 5500       // ~10% of card pixels
        })
    })

    test('random geometric card name matches generated type', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Select random-geometric source
        const srcSelect = page.locator('#card-src-select')
        await srcSelect.selectOption('random-geometric')

        // Wait for the source to load
        await page.waitForTimeout(500)

        // Get the generated name from the sticker instance
        const generatedName = await page.evaluate(() => {
            const card = document.getElementById('demo-card')
            return card.generatedName
        })

        // Get the value displayed in the card-name input field
        const inputValue = await page.locator('#card-name').inputValue()

        // Get the card-name attribute on the sticker element
        const cardNameAttr = await page.locator('#demo-card').getAttribute('card-name')

        // All three should match
        expect(generatedName).toBeTruthy()
        expect(inputValue).toBe(generatedName)
        expect(cardNameAttr).toBe(generatedName)

        // Geometric names should be one of the known types
        const validTypes = ['Circles', 'Triangles', 'Hexagons', 'Diamonds', 'Stars', 'Squares', 'Rings', 'Spirograph']
        expect(validTypes).toContain(generatedName)
    })
})

test.describe('Sticker Demo - Collection Name Systems', () => {
    test('collection is cleared and card name reset to Link when selecting custom URL', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Start with random-emoji (which auto-generates collection "EMOJI" and a card name)
        const srcSelect = page.locator('#card-src-select')
        await srcSelect.selectOption('random-emoji')
        await page.waitForTimeout(500)

        // Verify collection was set to EMOJI
        const collectionInput = page.locator('#card-collection')
        let collectionValue = await collectionInput.inputValue()
        expect(collectionValue).toBe('EMOJI')

        // Verify card name was auto-generated (not empty)
        const cardNameInput = page.locator('#card-name')
        let cardNameValue = await cardNameInput.inputValue()
        expect(cardNameValue).toBeTruthy()

        // Switch to custom URL - collection and card name should be cleared
        await srcSelect.selectOption('custom')
        await page.waitForTimeout(100)

        // Verify collection input and attribute are cleared
        collectionValue = await collectionInput.inputValue()
        expect(collectionValue).toBe('')

        const stickerCard = page.locator('#demo-card')
        const collectionAttr = await stickerCard.getAttribute('card-collection')
        expect(collectionAttr).toBe('')

        // Verify card name input and attribute are reset to default "Link"
        cardNameValue = await cardNameInput.inputValue()
        expect(cardNameValue).toBe('Link')

        const cardNameAttr = await stickerCard.getAttribute('card-name')
        expect(cardNameAttr).toBe('Link')
    })

    test('collection name can be set manually for custom URL via input', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Page starts in custom URL mode, verify collection is empty initially
        const collectionInput = page.locator('#card-collection')
        const initialValue = await collectionInput.inputValue()
        expect(initialValue).toBe('')

        // Type a collection name - this uses the input event handler directly
        await collectionInput.fill('My Collection')

        // Wait for the input event to propagate
        await page.waitForTimeout(100)

        // Verify the card-collection attribute was set via the input handler
        const stickerCard = page.locator('#demo-card')
        const collectionAttr = await stickerCard.getAttribute('card-collection')
        expect(collectionAttr).toBe('My Collection')
    })

    test('random emoji sets collection to EMOJI', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Select random-emoji source
        const srcSelect = page.locator('#card-src-select')
        await srcSelect.selectOption('random-emoji')

        // Wait for the generated content to load
        await page.waitForTimeout(500)

        // Verify collection input shows EMOJI
        const collectionInput = page.locator('#card-collection')
        const collectionValue = await collectionInput.inputValue()
        expect(collectionValue).toBe('EMOJI')

        // Verify the sticker's internal _isGeneratedContent flag is true
        const isGenerated = await page.evaluate(() => {
            const card = document.getElementById('demo-card')
            return card.sticker?._isGeneratedContent === true
        })
        expect(isGenerated).toBe(true)
    })

    test('switching back from generated to custom URL clears collection', async ({ page }) => {
        await page.goto('/sticker-demo.html')
        await page.waitForSelector('sticker-card')

        // Start with Random Emoji
        const srcSelect = page.locator('#card-src-select')
        await srcSelect.selectOption('random-emoji')
        await page.waitForTimeout(500)

        // Verify generated content has EMOJI collection
        const collectionInput = page.locator('#card-collection')
        let collectionValue = await collectionInput.inputValue()
        expect(collectionValue).toBe('EMOJI')

        // Switch back to custom URL
        await srcSelect.selectOption('custom')
        await page.waitForTimeout(200)

        // Verify collection is cleared
        collectionValue = await collectionInput.inputValue()
        expect(collectionValue).toBe('')

        const stickerCard = page.locator('#demo-card')
        const collectionAttr = await stickerCard.getAttribute('card-collection')
        expect(collectionAttr).toBe('')

        // Verify no longer generated content
        const isGenerated = await page.evaluate(() => {
            const card = document.getElementById('demo-card')
            return card.sticker?._isGeneratedContent === true
        })
        expect(isGenerated).toBe(false)
    })
})
