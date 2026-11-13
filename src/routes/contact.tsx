import { createFileRoute } from '@tanstack/react-router'
import { CONTACT_DOC } from '../../shared/site'
import { DocPage } from '../components/DocPage'

export const Route = createFileRoute('/contact')({
  component: () => <DocPage doc={CONTACT_DOC} />,
})
