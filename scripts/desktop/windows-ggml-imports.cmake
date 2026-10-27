# The archive and these headers are pinned to the same GGML commit. GPU modules remain unchanged.
foreach(name ggml ggml-base)
  add_library(${name} SHARED IMPORTED GLOBAL)
  set_target_properties(${name} PROPERTIES
    IMPORTED_IMPLIB "${GGML_IMPORT_LIB_DIR}/${name}.lib"
    IMPORTED_LOCATION "${WINDOWS_RUNTIME}/${name}.dll"
    INTERFACE_COMPILE_DEFINITIONS GGML_SHARED
    INTERFACE_INCLUDE_DIRECTORIES "${CMAKE_CURRENT_SOURCE_DIR}/include"
  )
endforeach()
