// Wave theme's Home (spec 3): the dark stage with Lady Justice, the user's
// folders, then every law as a waveform.
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';
import VoiceNewsCard from '../components/VoiceNewsCard';
import WaveHero from '../components/wave/WaveHero';
import FolderRow from '../components/wave/FolderRow';
import WaveLibrary from '../components/wave/WaveLibrary';

export default function WaveHome() {
  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui overflow-hidden">
      <AdBanner />
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        <WaveHero />
        <VoiceNewsCard />
        <FolderRow />
        <WaveLibrary />
      </div>
      <TabBar />
    </div>
  );
}
