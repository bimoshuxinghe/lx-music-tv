import { memo } from 'react'

import Theme from './Theme'
import UploadWallpaper from './UploadWallpaper'
import FontColor from './FontColor'
import FocusBorderColor from './FocusBorderColor'

export default memo(() => {
  return (
    <>
      <Theme />
      <UploadWallpaper />
      <FontColor />
      <FocusBorderColor />
    </>
  )
})
