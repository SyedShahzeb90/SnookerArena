import type { MenuItem } from "../types/menu";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  item: MenuItem;
  onAdd: () => void;
}

function MenuCard({
  item,
  onAdd,
}: Props) {
  return (
    <Card className="group cursor-pointer rounded-xl border transition-all duration-200 hover:scale-[1.03] hover:border-blue-500 hover:shadow-xl">
      <div className="flex h-full flex-col p-4">
        <div className="mb-4 flex-1">
          <h3 className="text-lg font-bold">
            {item.name}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {item.category}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-green-600">
            Rs. {item.price}
          </span>

          <Button
            size="icon"
            className="h-12 w-12 rounded-full text-xl"
            onClick={onAdd}
          >
            +
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default MenuCard;