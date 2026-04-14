import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Home from '../pages/Home'
import CalendarPage from '../pages/CalendarPage'
import TasksPage from '../pages/TasksPage'
import RoadmapPage from '../pages/RoadmapPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
      </Route>
    </Routes>
  )
}
