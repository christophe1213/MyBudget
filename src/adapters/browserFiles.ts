import type { BackupFiles } from '@/application/ports'

/** Téléchargement et choix de fichiers JSON dans le navigateur (téléphone compris). */
export class BrowserBackupFiles implements BackupFiles {
  download(fileName: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  pickText(): Promise<{ name: string; text: string } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json,.json'
      input.style.display = 'none'
      const done = (value: { name: string; text: string } | null): void => {
        input.remove()
        resolve(value)
      }
      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        done(file ? { name: file.name, text: await file.text() } : null)
      })
      input.addEventListener('cancel', () => done(null))
      document.body.appendChild(input)
      input.click()
    })
  }
}
