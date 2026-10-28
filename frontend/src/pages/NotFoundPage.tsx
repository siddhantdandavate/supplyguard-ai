import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => (
  <div className="rounded-lg border border-slate-200 bg-white shadow-card">
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you asked for does not exist. Use the navigation to get back on track."
      action={
        <Link to="/">
          <Button variant="secondary">Back to control center</Button>
        </Link>
      }
    />
  </div>
);
