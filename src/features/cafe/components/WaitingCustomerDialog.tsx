import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (name: string) => void;
}

function WaitingCustomerDialog({
  open,
  onOpenChange,
  onContinue,
}: Props) {
  const [name, setName] =
    useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            New Waiting Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>
              Customer Name
            </Label>

            <Input
              autoFocus
              placeholder="Enter customer name"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
            />
          </div>

          <Button
            className="w-full"
            disabled={!name.trim()}
            onClick={() => {
              onContinue(name.trim());
              setName("");
              onOpenChange(false);
            }}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WaitingCustomerDialog;