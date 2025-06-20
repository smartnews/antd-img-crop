import type { ModalProps, UploadProps } from 'antd';
import type { SliderBaseProps } from 'antd/es/slider';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import type { MutableRefObject } from 'react';
import type { CropperProps } from 'react-easy-crop';
import type { Area } from 'react-easy-crop/types';

export type BeforeUpload = Exclude<UploadProps['beforeUpload'], undefined>;
export type BeforeUploadReturnType = ReturnType<BeforeUpload>;

export type ImgCropProps = {
  quality?: number;
  fillColor?: string;

  zoomSlider?: boolean;
  rotationSlider?: boolean;
  aspectSlider?: boolean;
  showReset?: boolean;
  resetText?: string;

  zoomSliderProps?: SliderBaseProps;

  aspect?: number;
  minZoom?: number;
  maxZoom?: number;
  minAspect?: number;
  maxAspect?: number;
  cropShape?: 'rect' | 'round';
  showGrid?: boolean;
  cropperProps?: Partial<
    Omit<
      CropperProps,
      | 'image'
      | 'crop'
      | 'zoom'
      | 'rotation'
      | 'aspect'
      | 'minZoom'
      | 'maxZoom'
      | 'minAspect'
      | 'maxAspect'
      | 'zoomWithScroll'
      | 'cropShape'
      | 'showGrid'
      | 'onCropChange'
      | 'onZoomChange'
      | 'onRotationChange'
      | 'onCropComplete'
    >
  >;

  modalClassName?: string;
  modalTitle?: string;
  modalWidth?: number | string;
  modalOk?: string;
  modalCancel?: string;
  onModalOk?: (value: BeforeUploadReturnType) => void;
  onModalCancel?: (resolve: (value: BeforeUploadReturnType) => void) => void;
  modalProps?: Omit<
    ModalProps,
    | 'className'
    | 'title'
    | 'width'
    | 'okText'
    | 'cancelText'
    | 'onOk'
    | 'onCancel'
    | 'open'
    | 'visible'
    | 'wrapClassName'
    | 'maskClosable'
    | 'destroyOnClose'
  >;

  beforeCrop?: BeforeUpload;
  children: JSX.Element;
};

export type EasyCropRef = {
  rotation: number;
  cropPixelsRef: MutableRefObject<Area>;
  onReset: () => void;
};

export type EasyCropProps = {
  modalImage: string;
} & Required<
  Pick<
    ImgCropProps,
    | 'zoomSlider'
    | 'zoomSliderProps'
    | 'rotationSlider'
    | 'aspectSlider'
    | 'showReset'
    | 'aspect'
    | 'minZoom'
    | 'maxZoom'
    | 'minAspect'
    | 'maxAspect'
    | 'cropShape'
    | 'showGrid'
  >
> &
  Pick<ImgCropProps, 'cropperProps'> & { resetBtnText: string };

export type ImgCropRef = {
  editFile: (file: RcFile | UploadFile) => void;
};
