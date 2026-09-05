

export const HIGHLIGHT = "highlight"
export const PLAY = "play"

/**
 * @param {object} tap
 * @param {boolean} tap.touch - true for touch or pen input, false for a mouse
 * @param {boolean} tap.empty - whether the cell is free to play
 * @param {string} tap.pos - the cell's "x,y,w,z" key
 * @param {string|null} tap.armed - the cell highlighted by the previous tap
 * @returns {{action: string, armed: string|null}} what to do, and the new armed cell
 */
export function tapAction({ touch, empty, pos, armed }) {
    
    if (!touch) return { action: PLAY, armed: null }

    if (!empty) return { action: HIGHLIGHT, armed: null }

    if (armed !== pos) return { action: HIGHLIGHT, armed: pos }

    return { action: PLAY, armed: null }
}
