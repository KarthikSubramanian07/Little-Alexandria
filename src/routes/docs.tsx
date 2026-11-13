import { createFileRoute } from '@tanstack/react-router'
import { DOCS_DOC } from '../../shared/site'
import { DocPage } from '../components/DocPage'

export const Route = createFileRoute('/docs')({
  component: () => <DocPage doc={DOCS_DOC} />,
})
