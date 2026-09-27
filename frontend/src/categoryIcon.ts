import {
  Briefcase,
  Camera,
  Droplet,
  Dumbbell,
  Gamepad2,
  Lightbulb,
  LucideIcon,
  Music,
  Package,
  Router,
  Tablet,
  Tent
} from 'lucide-react';

// Categories observed in the mock store catalogue; anything new falls back to a parcel.
const ICONS: Record<string, LucideIcon> = {
  cameras: Camera,
  fitness: Dumbbell,
  gaming: Gamepad2,
  instruments: Music,
  lighting: Lightbulb,
  networking: Router,
  office: Briefcase,
  outdoor: Tent,
  'personal care': Droplet,
  tablets: Tablet
};

export const categoryIcon = (category?: string | null): LucideIcon =>
  (category && ICONS[category.toLowerCase()]) || Package;
