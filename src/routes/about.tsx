import { createFileRoute } from '@tanstack/react-router'
import { ABOUT_DOC } from '../../shared/site'
import { DocPage } from '../components/DocPage'

export const Route = createFileRoute('/about')({
  component: () => <DocPage doc={ABOUT_DOC} />,
})
