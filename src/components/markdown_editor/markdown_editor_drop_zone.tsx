/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { FunctionComponent, useEffect, useRef } from 'react';
import classNames from 'classnames';
import { useDropzone } from 'react-dropzone';
import { OuiMarkdownEditorFooter } from './markdown_editor_footer';
import {
  OuiMarkdownEditorUiPlugin,
  OuiMarkdownParseError,
  OuiMarkdownDropHandler,
  OuiMarkdownStringTagConfig,
  OuiMarkdownDragAndDropResult,
} from './markdown_types';
import { useResizeObserver } from '../observer/resize_observer';

interface OuiMarkdownEditorDropZoneProps {
  uiPlugins: OuiMarkdownEditorUiPlugin[];
  errors: OuiMarkdownParseError[];
  dropHandlers: OuiMarkdownDropHandler[];
  insertText: (text: string, config: OuiMarkdownStringTagConfig) => void;
  hasUnacceptedItems: boolean;
  setHasUnacceptedItems: (hasUnacceptedItems: boolean) => void;
  setEditorFooterHeight: (height: number) => void;
  isEditing: boolean;
}

const getUnacceptedItems = (
  items: DataTransferItemList,
  dropHandlers: OuiMarkdownDropHandler[]
) => {
  const unacceptedItems: DataTransferItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    let isAccepted = false;
    for (let j = 0; j < dropHandlers.length; j++) {
      if (dropHandlers[j].accepts(item.type)) {
        isAccepted = true;
        break;
      }
    }

    if (!isAccepted) {
      unacceptedItems.push(item);
    }
  }

  return unacceptedItems;
};

export const OuiMarkdownEditorDropZone: FunctionComponent<OuiMarkdownEditorDropZoneProps> = (
  props
) => {
  const [isDragging, toggleDragging] = React.useState(false);
  const [isUploadingFiles, toggleUploadingFiles] = React.useState(false);
  const [isDraggingError, toggleDraggingError] = React.useState(false);

  const {
    children,
    uiPlugins,
    errors,
    dropHandlers,
    insertText,
    hasUnacceptedItems,
    setHasUnacceptedItems,
    setEditorFooterHeight,
    isEditing,
  } = props;

  const classes = classNames('ouiMarkdownEditorDropZone', {
    'ouiMarkdownEditorDropZone--isDragging': isDragging,
    'ouiMarkdownEditorDropZone--hasError': hasUnacceptedItems,
    'ouiMarkdownEditorDropZone--isDraggingError': isDraggingError,
  });

  const editorFooterRef = useRef<HTMLDivElement>(null);

  const { height: editorFooterHeight } = useResizeObserver({
    elementRef: editorFooterRef,
    observableDimension: 'height',
  });

  useEffect(() => {
    if (editorFooterHeight !== 0) {
      setEditorFooterHeight(editorFooterHeight);
    }
  }, [setEditorFooterHeight, isEditing, editorFooterHeight]);

  const { getRootProps, getInputProps, open } = useDropzone({
    disabled: dropHandlers.length === 0,
    // Disable click and keydown behavior
    noClick: true,
    noKeyboard: true,
    // multiple: false,
    onDragOver: (e) => {
      let result: boolean;

      if (e.dataTransfer) {
        const unacceptedItems = getUnacceptedItems(
          e.dataTransfer.items,
          dropHandlers
        );
        setHasUnacceptedItems(unacceptedItems.length > 0);
        toggleDraggingError(unacceptedItems.length > 0);

        result = unacceptedItems.length === 0;
      } else {
        setHasUnacceptedItems(false);
        result = false;
      }

      toggleDragging(result);
      if (result === false) {
        e.preventDefault();
      }
      return result;
    },
    onDragEnter: (e) => {
      let result: boolean;

      if (e.dataTransfer) {
        const unacceptedItems = getUnacceptedItems(
          e.dataTransfer.items,
          dropHandlers
        );
        setHasUnacceptedItems(unacceptedItems.length > 0);
        toggleDraggingError(unacceptedItems.length > 0);

        result = unacceptedItems.length === 0;
      } else {
        setHasUnacceptedItems(false);
        result = false;
      }

      toggleDragging(result);
      if (result === false) {
        e.preventDefault();
      }
      return result;
    },
    onDragLeave: () => {
      toggleDragging(false);
    },
    onDrop: (acceptedFiles) => {
      const fileHandlers: OuiMarkdownDropHandler[] = [];

      // verify all files being dropped are supported
      preparation: for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];

        for (let j = 0; j < dropHandlers.length; j++) {
          if (dropHandlers[j].accepts(file.type)) {
            fileHandlers.push(dropHandlers[j]);
            continue preparation;
          }
        }

        // if we get here then a file isn't handled
        setHasUnacceptedItems(true);
        toggleDragging(false);
        toggleDraggingError(false);
        return;
      }

      toggleUploadingFiles(true);

      const resolved: Array<
        OuiMarkdownDragAndDropResult | Promise<OuiMarkdownDragAndDropResult>
      > = [];
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const handler = fileHandlers[i];
        resolved.push(handler.getFormattingForItem(file));
      }

      Promise.all(resolved)
        .then((results) => {
          results.forEach(({ text, config }) => insertText(text, config));
        })
        .catch(() => {})
        .then(() => {
          toggleDragging(false);
          toggleUploadingFiles(false);
          toggleDraggingError(false);
        });
    },
  });

  return (
    <div {...getRootProps()} className={classes}>
      {children}
      <OuiMarkdownEditorFooter
        ref={editorFooterRef}
        uiPlugins={uiPlugins}
        openFiles={() => {
          setHasUnacceptedItems(false);
          open();
        }}
        isUploadingFiles={isUploadingFiles}
        hasUnacceptedItems={hasUnacceptedItems}
        dropHandlers={dropHandlers}
        errors={errors}
      />
      <input {...getInputProps()} />
    </div>
  );
};
