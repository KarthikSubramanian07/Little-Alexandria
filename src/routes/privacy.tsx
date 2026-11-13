import { createFileRoute } from '@tanstack/react-router'
import { PRIVACY_DOC } from '../../shared/site'
import { DocPage } from '../components/DocPage'

export const Route = createFileRoute('/privacy')({
  component: () => <DocPage doc={PRIVACY_DOC} />,
})
