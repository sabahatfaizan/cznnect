import { createContext, useContext } from 'react'

// False for a screen that has been built in the background next to the one on show (see SwipePager). Such a screen must
// not do things that only make sense once somebody is looking at it, like marking chat messages as read.
export const ScreenVisible = createContext(true)
export const useScreenVisible = () => useContext(ScreenVisible)
