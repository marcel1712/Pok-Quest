import { expect, test } from '@playwright/test'

test.describe('unauthenticated access', () => {
  test('redirects the root route to /login and renders the login form', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'PokéQuest' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('rejects an obviously wrong login with a visible error', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('not-a-real-account@example.com')
    await page.getByLabel('Senha').fill('wrong-password')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})
