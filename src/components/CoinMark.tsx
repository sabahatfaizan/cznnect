import coin from '../assets/coin.webp'

// The pirate coin shown at the top of the home screen in the Uncharted theme (a cut-out of the supplied image).
export default function CoinMark({ className = '' }: { className?: string }) {
  return <img src={coin} alt="Cznnect" width={72} height={72} draggable={false} className={className} />
}
