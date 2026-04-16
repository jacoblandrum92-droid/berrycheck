"""
Berry YOLO Training
====================
Trains a YOLOv8 model on the berry dataset.

Prerequisites:
  pip install ultralytics

Usage:
  python train.py                    # train from scratch (YOLOv8n)
  python train.py --model yolov8s    # use small model (more accurate, slower)
  python train.py --resume           # resume interrupted training
  python train.py --epochs 200       # more epochs for better accuracy

Output:
  runs/detect/berry_v1/weights/best.pt  — best model weights
  Copy best.pt to app/ml/berry_model.pt for camera_service.py to use
"""

import argparse
import os
import shutil

def main():
    parser = argparse.ArgumentParser(description='Train berry detection model')
    parser.add_argument('--model', default='yolov8n', help='Base model (yolov8n/s/m)')
    parser.add_argument('--epochs', type=int, default=100, help='Training epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size')
    parser.add_argument('--resume', action='store_true', help='Resume training')
    parser.add_argument('--name', default='berry_v1', help='Run name')
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("Install ultralytics first:")
        print("  pip install ultralytics")
        return

    ml_dir = os.path.dirname(os.path.abspath(__file__))
    data_yaml = os.path.join(ml_dir, 'dataset.yaml')

    # Check dataset exists
    train_imgs = os.path.join(ml_dir, 'dataset', 'images', 'train')
    n_train = len([f for f in os.listdir(train_imgs) if f.endswith('.jpg')]) if os.path.exists(train_imgs) else 0
    val_imgs = os.path.join(ml_dir, 'dataset', 'images', 'val')
    n_val = len([f for f in os.listdir(val_imgs) if f.endswith('.jpg')]) if os.path.exists(val_imgs) else 0

    print(f"Dataset: {n_train} train, {n_val} val images")

    if n_train < 5:
        print(f"\nNeed at least 5 training images. Run capture.py first.")
        return

    if n_val == 0:
        # Auto-split: move 20% of training to val
        import random
        all_imgs = [f for f in os.listdir(train_imgs) if f.endswith('.jpg')]
        random.shuffle(all_imgs)
        n_move = max(1, len(all_imgs) // 5)
        print(f"No val set — moving {n_move} images from train to val")

        train_lbls = os.path.join(ml_dir, 'dataset', 'labels', 'train')
        val_lbls = os.path.join(ml_dir, 'dataset', 'labels', 'val')

        for img_file in all_imgs[:n_move]:
            lbl_file = img_file.replace('.jpg', '.txt')
            shutil.move(os.path.join(train_imgs, img_file), os.path.join(val_imgs, img_file))
            lbl_src = os.path.join(train_lbls, lbl_file)
            if os.path.exists(lbl_src):
                shutil.move(lbl_src, os.path.join(val_lbls, lbl_file))

        n_train -= n_move
        n_val = n_move
        print(f"Split: {n_train} train, {n_val} val")

    # Load model
    if args.resume:
        last_pt = os.path.join(ml_dir, 'runs', 'detect', args.name, 'weights', 'last.pt')
        if not os.path.exists(last_pt):
            print(f"No checkpoint found at {last_pt}")
            return
        model = YOLO(last_pt)
        print(f"Resuming from {last_pt}")
    else:
        model = YOLO(f'{args.model}.pt')
        print(f"Starting from pretrained {args.model}")

    # Train
    model.train(
        data=data_yaml,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        project=os.path.join(ml_dir, 'runs', 'detect'),
        name=args.name,
        exist_ok=True,
        device='cpu',
        workers=2,
        patience=20,  # early stopping
        save=True,
        plots=True,
    )

    # Copy best weights to the standard location
    best_pt = os.path.join(ml_dir, 'runs', 'detect', args.name, 'weights', 'best.pt')
    deploy_pt = os.path.join(ml_dir, 'berry_model.pt')
    if os.path.exists(best_pt):
        shutil.copy2(best_pt, deploy_pt)
        print(f"\nModel saved to {deploy_pt}")
        print("camera_service.py will auto-detect and use it.")


if __name__ == '__main__':
    main()
