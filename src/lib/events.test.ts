import { describe, expect, it } from 'vitest'
import { create } from 'qrcode'
import jsQR from 'jsqr'
import { guestTicketUrl, inviteUrl, readInvite, readTicket } from './events'
import { readPublicLink } from './publicEvent'

describe('event links', () => {
  it('the invite is a normal web link that the app and the public page both read', () => {
    const url = inviteUrl('a1b2c3')
    expect(url).toMatch(/^https:\/\/.+\/\?join=a1b2c3$/)
    expect(readInvite(url)).toBe('A1B2C3')
    expect(readPublicLink('?join=a1b2c3')).toEqual({ join: 'A1B2C3' })
    expect(readInvite('cznnect-event:a1b2c3')).toBe('A1B2C3') // old printed codes still work
    expect(readInvite('https://example.com/?x=1')).toBeNull()
  })
  it('a guest ticket is read from its link, an account ticket from its old text', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000'
    expect(readTicket(guestTicketUrl(id))).toEqual({ kind: 'guest', guestId: id })
    expect(readTicket(`cznnect-ticket:${id}:${id}`)).toEqual({ kind: 'user', eventId: id, userId: id })
    expect(readPublicLink(`?ticket=${id}`)).toEqual({ ticket: id })
  })
  it('the invite QR decodes back to the link with a standard reader', () => {
    const url = inviteUrl('A1B2C3')
    const { size, data } = create(url, { errorCorrectionLevel: 'M' }).modules
    const scale = 8, quiet = 4, side = (size + quiet * 2) * scale
    const px = new Uint8ClampedArray(side * side * 4).fill(255)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y * size + x] === 1) {
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4
        px[i] = px[i + 1] = px[i + 2] = 0
      }
    }
    expect(jsQR(px, side, side)?.data).toBe(url)
  })
})
