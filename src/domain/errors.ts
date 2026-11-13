/** Une règle métier n'est pas respectée (le message est destiné à l'utilisateur). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
