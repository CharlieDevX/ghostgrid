import SystemStats from '../components/SystemStats'
import NetworkWidget from '../components/NetworkWidget'
import DockerWidget from '../components/DockerWidget'
import BookmarksWidget from '../components/BookmarksWidget'
import NotesWidget from '../components/NotesWidget'

export default function Home() {
  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>Dashboard</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
      }}>
        <SystemStats />
        <NetworkWidget />
        <DockerWidget />
        <BookmarksWidget />
        <NotesWidget />
      </div>
    </div>
  )
}
