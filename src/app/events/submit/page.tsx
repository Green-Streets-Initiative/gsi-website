import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import SubmitEventForm from '@/components/events/SubmitEventForm'

export const metadata = {
  title: 'Submit an Event — Community Events — Green Streets Initiative',
  description: 'Submit a group ride, walking tour, e-bike demo, civic action, or festival to the Green Streets community events calendar.',
}

export default function SubmitEventPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <SubmitEventForm />
      </main>
      <Footer />
    </>
  )
}
