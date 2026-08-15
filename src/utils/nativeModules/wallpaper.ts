import { NativeEventEmitter, NativeModules } from 'react-native'

const { WallpaperModule } = NativeModules

export const startWallpaperServer = (dir: string): Promise<number> => WallpaperModule.start(dir)

export const stopWallpaperServer = () => {
  WallpaperModule.stop()
}

export const onWallpaperUploaded = (handler: (path: string) => void): () => void => {
  const eventEmitter = new NativeEventEmitter(WallpaperModule)
  const eventListener = eventEmitter.addListener('wallpaper-uploaded', event => {
    handler(event.path)
  })

  return () => {
    eventListener.remove()
  }
}
