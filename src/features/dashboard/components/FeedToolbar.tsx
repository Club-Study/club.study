import { ChevronDownIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { Club } from "@/features/clubs/api";
import type { FeedDensity } from "@/features/dashboard/feed";

export function FeedToolbar({
  search,
  onSearchChange,
  clubs,
  selectedClubId,
  onClubChange,
  showPast,
  onShowPastChange,
  density,
  onDensityChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  clubs: Club[];
  selectedClubId: string | null;
  onClubChange: (clubId: string | null) => void;
  showPast: boolean;
  onShowPastChange: (showPast: boolean) => void;
  density: FeedDensity;
  onDensityChange: (density: FeedDensity) => void;
}) {
  const selectedClub = clubs.find((club) => club.id === selectedClubId);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center">
      <div className="relative min-w-0">
        <Label htmlFor="feed-search" className="sr-only">
          Search papers
        </Label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="feed-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search titles and abstracts"
          className="bg-card/30 pl-9 shadow-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Filter by club: ${selectedClub?.name ?? "All clubs"}`}
              className="min-w-32 max-w-56 justify-between bg-transparent shadow-none"
            >
              <span className="truncate">
                {selectedClub?.name ?? "All clubs"}
              </span>
              <ChevronDownIcon aria-hidden="true" className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Filter by club</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={selectedClubId ?? "all"}
              onValueChange={(value) =>
                onClubChange(value === "all" ? null : value)
              }
            >
              <DropdownMenuRadioItem value="all">
                All clubs
              </DropdownMenuRadioItem>
              {clubs.map((club) => (
                <DropdownMenuRadioItem key={club.id} value={club.id}>
                  {club.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex h-8 items-center gap-2 rounded-md px-2">
          <Switch
            id="feed-show-past"
            size="sm"
            checked={showPast}
            onCheckedChange={onShowPastChange}
          />
          <Label htmlFor="feed-show-past" className="text-xs font-normal">
            Past
          </Label>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={density}
          onValueChange={(value) => {
            if (value === "comfortable" || value === "compact") {
              onDensityChange(value);
            }
          }}
          aria-label="Feed density"
        >
          <ToggleGroupItem value="comfortable">
            Comfortable
          </ToggleGroupItem>
          <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
