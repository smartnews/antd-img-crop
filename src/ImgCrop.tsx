import type { ModalProps } from 'antd';
import AntModal from 'antd/es/modal';
import AntUpload from 'antd/es/upload';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import type { MouseEvent, ReactNode } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import EasyCrop from './EasyCrop';
import './ImgCrop.css';
import { PREFIX, ROTATION_INITIAL } from './constants';
import type {
  BeforeUpload,
  BeforeUploadReturnType,
  EasyCropRef,
  ImgCropProps,
  ImgCropRef,
} from './types';

export type { ImgCropProps, ImgCropRef } from './types';

const ImgCrop = forwardRef<ImgCropRef, ImgCropProps>((props, ref) => {
  const {
    quality = 0.4,
    fillColor = 'white',

    zoomSlider = true,
    rotationSlider = false,
    aspectSlider = false,
    showReset = false,
    resetText,

    zoomSliderProps = {},

    aspect = 1,
    minZoom = 1,
    maxZoom = 3,
    minAspect = 0.5,
    maxAspect = 2,
    cropShape = 'rect',
    showGrid = false,
    cropperProps,

    modalClassName,
    modalTitle,
    modalWidth,
    modalOk,
    modalCancel,
    onModalOk,
    onModalCancel,
    modalProps,

    beforeCrop,
    children,
  } = props;

  // Store latest callback props in a ref to avoid stale closures
  const cb = useRef<
    Pick<ImgCropProps, 'onModalOk' | 'onModalCancel' | 'beforeCrop'>
  >({});
  cb.current.onModalOk = onModalOk;
  cb.current.onModalCancel = onModalCancel;
  cb.current.beforeCrop = beforeCrop;

  /**
   * crop
   *
   * Ref to EasyCrop component and utility for cropping canvas from image
   */
  const easyCropRef = useRef<EasyCropRef>(null);
  const getCropCanvas = useCallback(
    (target: ShadowRoot) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      const context = (target?.getRootNode?.() as ShadowRoot) || document;

      type ImgSource = CanvasImageSource & {
        naturalWidth: number;
        naturalHeight: number;
      };

      const imgSource = context.querySelector(`.${PREFIX}-media`) as ImgSource;

      const {
        width: cropWidth,
        height: cropHeight,
        x: cropX,
        y: cropY,
      } = easyCropRef.current!.cropPixelsRef.current;

      // If image is rotated, we draw it in a larger square canvas, then crop the relevant section
      if (
        rotationSlider &&
        easyCropRef.current!.rotation !== ROTATION_INITIAL
      ) {
        const { naturalWidth: imgWidth, naturalHeight: imgHeight } = imgSource;
        const angle = easyCropRef.current!.rotation * (Math.PI / 180);

        // get container for rotated image
        const sine = Math.abs(Math.sin(angle));
        const cosine = Math.abs(Math.cos(angle));
        const squareWidth = imgWidth * cosine + imgHeight * sine;
        const squareHeight = imgHeight * cosine + imgWidth * sine;

        canvas.width = squareWidth;
        canvas.height = squareHeight;
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, squareWidth, squareHeight);

        // rotate container
        const squareHalfWidth = squareWidth / 2;
        const squareHalfHeight = squareHeight / 2;
        ctx.translate(squareHalfWidth, squareHalfHeight);
        ctx.rotate(angle);
        ctx.translate(-squareHalfWidth, -squareHalfHeight);

        // draw rotated image
        const imgX = (squareWidth - imgWidth) / 2;
        const imgY = (squareHeight - imgHeight) / 2;
        ctx.drawImage(
          imgSource,
          0,
          0,
          imgWidth,
          imgHeight,
          imgX,
          imgY,
          imgWidth,
          imgHeight,
        );

        // crop rotated image
        const imgData = ctx.getImageData(0, 0, squareWidth, squareHeight);
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.putImageData(imgData, -cropX, -cropY);
      } else {
        // Standard (non-rotated) image crop
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, cropWidth, cropHeight);

        ctx.drawImage(
          imgSource,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight,
        );
      }

      return canvas;
    },
    [fillColor, rotationSlider],
  );

  /**
   * upload
   *
   * Modal state and lifecycle hooks
   */
  const [modalImage, setModalImage] = useState('');
  const onCancel = useRef<ModalProps['onCancel']>();
  const onOk = useRef<ModalProps['onOk']>();

  // Helper to run Ant Design's original beforeUpload handler
  const runBeforeUpload = useCallback(
    async ({
      beforeUpload,
      file,
      resolve,
      reject,
    }: {
      beforeUpload: BeforeUpload | undefined;
      file: RcFile;
      resolve: (parsedFile: BeforeUploadReturnType) => void;
      reject: (rejectErr: BeforeUploadReturnType) => void;
    }) => {
      const rawFile = file as unknown as File;

      if (typeof beforeUpload !== 'function') {
        resolve(rawFile);
        return;
      }

      try {
        // https://ant.design/components/upload-cn#api
        // https://github.com/ant-design/ant-design/blob/master/components/upload/Upload.tsx#L152-L178
        const result = await beforeUpload(file, [file]);

        if (result === false) {
          resolve(false);
        } else {
          resolve((result !== true && result) || rawFile);
        }
      } catch (err) {
        reject(err as BeforeUploadReturnType);
      }
    },
    [],
  );

  // Compose a beforeUpload handler that includes cropper modal logic
  const getNewBeforeUpload = useCallback(
    (beforeUpload: BeforeUpload) => {
      return ((file, fileList) => {
        return new Promise(async (resolve, reject) => {
          let processedFile = file;

          // Optional pre-crop hook
          if (typeof cb.current.beforeCrop === 'function') {
            try {
              const result = await cb.current.beforeCrop(file, fileList);
              if (result === false) {
                return runBeforeUpload({ beforeUpload, file, resolve, reject }); // not open modal
              }
              if (result !== true) {
                processedFile = (result as unknown as RcFile) || file; // will open modal
              }
            } catch (err) {
              return runBeforeUpload({ beforeUpload, file, resolve, reject }); // not open modal
            }
          }

          // Read file to show in modal
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            if (typeof reader.result === 'string') {
              setModalImage(reader.result); // Trigger modal open
            }
          });
          reader.readAsDataURL(processedFile as unknown as Blob);

          // Define modal handlers
          onCancel.current = () => {
            setModalImage('');
            easyCropRef.current!.onReset();

            let hasResolveCalled = false;

            cb.current.onModalCancel?.((LIST_IGNORE) => {
              resolve(LIST_IGNORE);
              hasResolveCalled = true;
            });

            if (!hasResolveCalled) {
              resolve(AntUpload.LIST_IGNORE);
            }
          };

          // on modal confirm
          onOk.current = async (event: MouseEvent<HTMLElement>) => {
            setModalImage('');
            easyCropRef.current!.onReset();

            const canvas = getCropCanvas(event.target as ShadowRoot);
            const { type, name, uid } = processedFile as UploadFile;

            canvas.toBlob(
              async (blob) => {
                const newFile = new File([blob as BlobPart], name, { type });
                Object.assign(newFile, { uid });

                runBeforeUpload({
                  beforeUpload,
                  file: newFile as unknown as RcFile,
                  resolve: (file) => {
                    resolve(file);
                    cb.current.onModalOk?.(file);
                  },
                  reject: (err) => {
                    reject(err);
                    cb.current.onModalOk?.(err);
                  },
                });
              },
              type,
              quality,
            );
          };
        });
      }) as BeforeUpload;
    },
    [getCropCanvas, quality, runBeforeUpload],
  );

  // Enhance Upload component with custom beforeUpload
  const getNewUpload = useCallback(
    (children: ReactNode) => {
      const upload = Array.isArray(children) ? children[0] : children;
      const { beforeUpload, accept, ...restUploadProps } = upload.props;

      return {
        ...upload,
        props: {
          ...restUploadProps,
          accept: accept || 'image/*',
          beforeUpload: getNewBeforeUpload(beforeUpload),
        },
      };
    },
    [getNewBeforeUpload],
  );

  /**
   * modal
   *
   * Extract modal config props
   */
  const modalBaseProps = useMemo(() => {
    const obj: Pick<ModalProps, 'width' | 'okText' | 'cancelText'> = {};
    if (modalWidth !== undefined) obj.width = modalWidth;
    if (modalOk !== undefined) obj.okText = modalOk;
    if (modalCancel !== undefined) obj.cancelText = modalCancel;
    return obj;
  }, [modalCancel, modalOk, modalWidth]);

  const wrapClassName = `${PREFIX}-modal${
    modalClassName ? ` ${modalClassName}` : ''
  }`;

  const lang = typeof window === 'undefined' ? '' : window.navigator.language;
  const isCN = lang === 'zh-CN';
  const title = modalTitle || (isCN ? '编辑图片' : 'Edit image');
  const resetBtnText = resetText || (isCN ? '重置' : 'Reset');

  // Exposes `editFile` method to parent via ref, allowing programmatic cropping
  const editFile = useCallback(
    (file: RcFile | UploadFile) => {
      runBeforeUpload({
        beforeUpload: cb.current.beforeCrop, // always provide a function
        file: file as RcFile,
        resolve: (file) => {
          console.log('Crop successful:', file);
          cb.current.onModalOk?.(file);
        },
        reject: (err) => {
          console.error('Crop rejected during runBeforeUpload:', err);
        },
      });
    },
    [getCropCanvas, quality],
  );

  // Expose the editFile method to parent components
  useImperativeHandle(
    ref,
    () => ({
      editFile,
    }),
    [editFile],
  );

  return (
    <>
      {getNewUpload(children)}
      {modalImage && (
        <AntModal
          {...modalProps}
          {...modalBaseProps}
          open
          title={title}
          onCancel={onCancel.current}
          onOk={onOk.current}
          wrapClassName={wrapClassName}
          maskClosable={false}
          destroyOnClose
        >
          <EasyCrop
            ref={easyCropRef}
            zoomSlider={zoomSlider}
            zoomSliderProps={zoomSliderProps}
            rotationSlider={rotationSlider}
            aspectSlider={aspectSlider}
            showReset={showReset}
            resetBtnText={resetBtnText}
            modalImage={modalImage}
            aspect={aspect}
            minZoom={minZoom}
            maxZoom={maxZoom}
            minAspect={minAspect}
            maxAspect={maxAspect}
            cropShape={cropShape}
            showGrid={showGrid}
            cropperProps={cropperProps}
          />
        </AntModal>
      )}
    </>
  );
});

export default ImgCrop;
