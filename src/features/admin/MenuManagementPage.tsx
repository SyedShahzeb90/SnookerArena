import {
  ArrowLeft,
  ImagePlus,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useCafeStore,
  type MenuItemInput,
} from "@/features/cafe/store/cafeStore";
import type { MenuItem } from "@/features/cafe/types/menu";

const menuCategories: MenuItem["category"][] = [
  "Snacks",
  "Fast Food",
  "Drinks",
  "Tea / Coffee",
  "Desserts",
  "Other",
];

const emptyForm: MenuItemInput = {
  name: "",
  category: "Fast Food",
  price: 0,
  emoji: "",
  imageDataUrl: "",
  isAvailable: true,
};

function MenuManagementPage() {
  const navigate = useNavigate();
  const {
    menu,
    addMenuItem,
    updateMenuItem,
    toggleMenuItemAvailability,
    deleteMenuItem,
  } = useCafeStore();

  const [form, setForm] =
    useState<MenuItemInput>(emptyForm);
  const [editingItem, setEditingItem] =
    useState<MenuItem | null>(null);
  const [message, setMessage] =
    useState("");
  const [error, setError] = useState("");

  const handlePhotoChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = reject;
        nextImage.src = source;
      });
      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);

      setForm((current) => ({
        ...current,
        imageDataUrl: canvas.toDataURL("image/jpeg", 0.82),
      }));
      setError("");
    } catch {
      setError("The selected photo could not be loaded.");
    }
  };

  const summary = useMemo(() => {
    const available = menu.filter(
      (item) =>
        item.isAvailable ??
        item.available
    ).length;

    return {
      total: menu.length,
      available,
      unavailable:
        menu.length - available,
      categories: new Set(
        menu.map((item) => item.category)
      ).size,
    };
  }, [menu]);

  const sortedMenu = useMemo(
    () =>
      [...menu].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    [menu]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
  };

  const handleSubmit = (
    event: FormEvent
  ) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const name = form.name.trim();

    if (!name) {
      setError("Item name is required.");
      return;
    }

    if (!form.category) {
      setError("Category is required.");
      return;
    }

    if (!form.price || form.price <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    const input: MenuItemInput = {
      ...form,
      name,
      emoji: form.emoji?.trim(),
    };

    if (editingItem) {
      updateMenuItem(editingItem.id, input);
      setMessage("Menu item updated.");
    } else {
      addMenuItem(input);
      setMessage("Menu item added.");
    }

    resetForm();
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category,
      price: item.price,
      emoji: item.emoji ?? "",
      imageDataUrl: item.imageDataUrl ?? "",
      isAvailable:
        item.isAvailable ??
        item.available,
    });
    setMessage("");
    setError("");
  };

  const handleDelete = (item: MenuItem) => {
    const confirmed = window.confirm(
      `Delete ${item.name}? Existing orders and sales will keep their old item details.`
    );

    if (!confirmed) return;

    deleteMenuItem(item.id);
    setMessage("Menu item deleted.");

    if (editingItem?.id === item.id) {
      resetForm();
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-3 gap-2"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Button>
            <h1 className="text-2xl font-bold text-slate-950">
              Menu Management
            </h1>
            <p className="text-sm text-slate-500">
              Add items, change prices, and control availability.
            </p>
          </div>
        </div>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ["Total Items", summary.total],
            ["Available Items", summary.available],
            ["Unavailable Items", summary.unavailable],
            ["Categories Count", summary.categories],
          ].map(([label, value]) => (
            <Card
              key={label}
              className="rounded-lg bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {value}
              </p>
            </Card>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Card className="p-4">
            <h2 className="mb-4 font-bold text-slate-950">
              {editingItem
                ? "Edit Menu Item"
                : "Add Menu Item"}
            </h2>

            {message && (
              <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {message}
              </p>
            )}
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <form
              className="space-y-4"
              onSubmit={handleSubmit}
            >
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Item name
                </label>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Category
                </label>
                <Input
                  className="mt-1"
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value,
                    })
                  }
                  list="menu-category-options"
                />
                <datalist id="menu-category-options">
                  {menuCategories.map((category) => (
                    <option
                      key={category}
                      value={category}
                    />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a suggestion or type a new category.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Price
                </label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={form.price || ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      price:
                        Number(
                          event.target.value
                        ) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Emoji / Icon
                </label>
                <Input
                  className="mt-1"
                  value={form.emoji ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      emoji: event.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Product photo
                </label>
                {form.imageDataUrl ? (
                  <div className="relative mt-1 overflow-hidden rounded-lg border bg-slate-100">
                    <img
                      src={form.imageDataUrl}
                      alt="Product preview"
                      className="h-44 w-full object-contain"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      title="Remove photo"
                      className="absolute right-2 top-2"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          imageDataUrl: "",
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                <label className="mt-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" />
                  {form.imageDataUrl ? "Replace photo" : "Choose photo from PC"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isAvailable:
                        event.target.checked,
                    })
                  }
                />
                Available in Cafe POS
              </label>

              <div className="grid grid-cols-2 gap-2">
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                  {editingItem ? "Save" : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Clear
                </Button>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMenu.map((item) => {
                  const available =
                    item.isAvailable ??
                    item.available;

                  return (
                    <tr
                      key={item.id}
                      className="border-t bg-white"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {item.imageDataUrl ? (
                          <img
                            src={item.imageDataUrl}
                            alt=""
                            className="mr-2 inline-block h-10 w-10 rounded object-cover align-middle"
                          />
                        ) : (
                          <span className="mr-2">{item.emoji}</span>
                        )}
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        Rs. {item.price}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            available
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                          }`}
                        >
                          {available
                            ? "Available"
                            : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleEdit(item)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleMenuItemAvailability(
                                item.id
                              )
                            }
                          >
                            {available ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                            {available
                              ? "Disable"
                              : "Enable"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleDelete(item)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default MenuManagementPage;
